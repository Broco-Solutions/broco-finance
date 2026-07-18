import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;

const skip = !TEST_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function expectRejected(promise: Promise<unknown>, label: string) {
  try {
    await promise;
    throw new Error(`${label}: se esperaba rechazo de PostgreSQL pero la operacion fue aceptada`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith(`${label}:`)) throw error;
  }
}

describe.skipIf(skip)("constraints SQL", () => {
  let prefix: string;
  let clientId: string;
  let projectId: string;
  let categoryId: string;

  beforeAll(async () => {
    prefix = `sql_${Date.now()}_`;
    const clientA = await prisma.client.create({ data: { name: `${prefix}Client A` } });
    clientId = clientA.id;
    const proj = await prisma.project.create({
      data: { clientId, name: `${prefix}Project` },
    });
    projectId = proj.id;
    const cat = await prisma.expenseCategory.create({ data: { name: `${prefix}Category` } });
    categoryId = cat.id;
  });

  it("1. rechaza Income PENDING sin dueDate", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test",
          status: "PENDING",
          amountUsd: 100,
        },
      }),
      "Income PENDING sin dueDate",
    );
  });

  it("2. rechaza Income PENDING con effectiveDate", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test",
          status: "PENDING",
          amountUsd: 100,
          dueDate: new Date("2026-12-01"),
          effectiveDate: new Date("2026-01-01"),
        },
      }),
      "Income PENDING con effectiveDate",
    );
  });

  it("3. rechaza Income PAID sin effectiveDate", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test",
          status: "PAID",
          amountUsd: 100,
        },
      }),
      "Income PAID sin effectiveDate",
    );
  });

  it("4. rechaza Income con amountUsd <= 0", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test",
          status: "PAID",
          amountUsd: 0,
          effectiveDate: new Date(),
        },
      }),
      "Income con amountUsd = 0",
    );
  });

  it("5. rechaza Income con ARS sin tipo de cambio", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test",
          status: "PAID",
          amountUsd: 100,
          amountArs: 100000,
          effectiveDate: new Date(),
        },
      }),
      "Income con ARS sin exchangeRate",
    );
  });

  it("6. rechaza Income con tipo de cambio sin ARS", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test",
          status: "PAID",
          amountUsd: 100,
          exchangeRate: 1000,
          effectiveDate: new Date(),
        },
      }),
      "Income con exchangeRate sin ARS",
    );
  });

  it("7. rechaza DEVELOPMENT sin proyecto", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "DEVELOPMENT",
          concept: "test",
          status: "PAID",
          amountUsd: 100,
          effectiveDate: new Date(),
        },
      }),
      "DEVELOPMENT sin projectId",
    );
  });

  it("8. rechaza MAINTENANCE sin proyecto", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "MAINTENANCE",
          concept: "test",
          status: "PAID",
          amountUsd: 100,
          effectiveDate: new Date(),
        },
      }),
      "MAINTENANCE sin projectId",
    );
  });

  it("9. rechaza Expense PENDING sin dueDate", async () => {
    await expectRejected(
      prisma.expense.create({
        data: {
          expenseCategoryId: categoryId,
          type: "FIXED",
          concept: "test",
          status: "PENDING",
          amountUsd: 50,
        },
      }),
      "Expense PENDING sin dueDate",
    );
  });

  it("10. rechaza Expense PAID sin effectiveDate", async () => {
    await expectRejected(
      prisma.expense.create({
        data: {
          expenseCategoryId: categoryId,
          type: "FIXED",
          concept: "test",
          status: "PAID",
          amountUsd: 50,
        },
      }),
      "Expense PAID sin effectiveDate",
    );
  });

  it("11. rechaza Expense con amountUsd <= 0", async () => {
    await expectRejected(
      prisma.expense.create({
        data: {
          expenseCategoryId: categoryId,
          type: "FIXED",
          concept: "test",
          status: "PAID",
          amountUsd: -1,
          effectiveDate: new Date(),
        },
      }),
      "Expense con amountUsd negativo",
    );
  });

  it("12. rechaza Project con bloque monetario parcial (ARS sin TC)", async () => {
    await expectRejected(
      prisma.project.create({
        data: {
          clientId,
          name: `${prefix}Partial ARS Project`,
          oneTimeOriginalAmount: 100000,
          oneTimeCurrency: "ARS",
          oneTimeAmountUsd: 100,
        },
      }),
      "Project ARS sin exchangeRate",
    );
  });

  it("13. rechaza Project ARS con exchangeRate <= 0", async () => {
    await expectRejected(
      prisma.project.create({
        data: {
          clientId,
          name: `${prefix}Bad ARS Project`,
          oneTimeOriginalAmount: 100000,
          oneTimeCurrency: "ARS",
          oneTimeExchangeRate: 0,
          oneTimeAmountUsd: 100,
        },
      }),
      "Project ARS con exchangeRate = 0",
    );
  });

  it("14. rechaza Project USD con exchangeRate no nulo", async () => {
    await expectRejected(
      prisma.project.create({
        data: {
          clientId,
          name: `${prefix}Bad USD Project`,
          oneTimeOriginalAmount: 100,
          oneTimeCurrency: "USD",
          oneTimeExchangeRate: 1000,
          oneTimeAmountUsd: 100,
        },
      }),
      "Project USD con exchangeRate",
    );
  });

  it("15. rechaza nombre duplicado de cliente (case-insensitive)", async () => {
    await prisma.client.create({ data: { name: `${prefix}dup test` } });
    await expectRejected(
      prisma.client.create({ data: { name: `${prefix}DUP TEST` } }),
      "Cliente duplicado case-insensitive",
    );
  });

  it("16. rechaza proyecto duplicado dentro del mismo cliente (case-insensitive)", async () => {
    await prisma.project.create({ data: { clientId, name: `${prefix}proj dup` } });
    await expectRejected(
      prisma.project.create({ data: { clientId, name: `${prefix}PROJ DUP` } }),
      "Proyecto duplicado case-insensitive",
    );
  });

  it("17. rechaza categoria duplicada (case-insensitive)", async () => {
    await prisma.expenseCategory.create({ data: { name: `${prefix}cat dup` } });
    await expectRejected(
      prisma.expenseCategory.create({ data: { name: `${prefix}CAT DUP` } }),
      "Categoria duplicada case-insensitive",
    );
  });

  // --- Monetary consistency: Income ---

  it("18. acepta Income ARS valido (amountUsd = round(amountArs / exchangeRate, 6))", async () => {
    const income = await prisma.income.create({
      data: {
        type: "OTHER",
        concept: "test ars valid",
        status: "PAID",
        amountUsd: 1.234568,
        amountArs: 1000.00,
        exchangeRate: 810.000000,
        effectiveDate: new Date("2026-01-15"),
      },
    });
    expect(income.id).toBeDefined();
  });

  it("19. rechaza Income ARS con amountUsd inconsistente (diferencia > 0.00001)", async () => {
    await expectRejected(
      prisma.income.create({
        data: {
          type: "OTHER",
          concept: "test ars bad",
          status: "PAID",
          amountUsd: 1.23,  // correcto: ~1.234568, diferencia ~0.004 >> 0.00001
          amountArs: 1000.00,
          exchangeRate: 810.000000,
          effectiveDate: new Date("2026-01-15"),
        },
      }),
      "Income ARS inconsistente",
    );
  });

  it("20. acepta Income exclusivamente USD", async () => {
    const income = await prisma.income.create({
      data: {
        type: "OTHER",
        concept: "test usd only",
        status: "PAID",
        amountUsd: 150.50,
        effectiveDate: new Date("2026-01-15"),
      },
    });
    expect(income.id).toBeDefined();
    expect(income.amountArs).toBeNull();
    expect(income.exchangeRate).toBeNull();
  });

  // --- Monetary consistency: Expense ---

  it("21. acepta Expense ARS valido", async () => {
    const expense = await prisma.expense.create({
      data: {
        expenseCategoryId: categoryId,
        type: "FIXED",
        concept: "test exp ars valid",
        status: "PAID",
        amountUsd: 0.617284,
        amountArs: 500.00,
        exchangeRate: 810.000000,
        effectiveDate: new Date("2026-01-15"),
      },
    });
    expect(expense.id).toBeDefined();
  });

  it("22. rechaza Expense ARS con amountUsd inconsistente", async () => {
    await expectRejected(
      prisma.expense.create({
        data: {
          expenseCategoryId: categoryId,
          type: "FIXED",
          concept: "test exp ars bad",
          status: "PAID",
          amountUsd: 0.60,  // correcto: ~0.617284, diferencia ~0.017 >> 0.00001
          amountArs: 500.00,
          exchangeRate: 810.000000,
          effectiveDate: new Date("2026-01-15"),
        },
      }),
      "Expense ARS inconsistente",
    );
  });

  it("23. acepta Expense exclusivamente USD", async () => {
    const expense = await prisma.expense.create({
      data: {
        expenseCategoryId: categoryId,
        type: "FIXED",
        concept: "test exp usd only",
        status: "PAID",
        amountUsd: 75.00,
        effectiveDate: new Date("2026-01-15"),
      },
    });
    expect(expense.id).toBeDefined();
    expect(expense.amountArs).toBeNull();
    expect(expense.exchangeRate).toBeNull();
  });

  // --- Monetary consistency: Project one-time ---

  it("24. acepta Project one-time ARS valido", async () => {
    const client2 = await prisma.client.create({ data: { name: `${prefix}Test Client OneTime ARS` } });
    const proj = await prisma.project.create({
      data: {
        clientId: client2.id,
        name: `${prefix}OneTime ARS Valid`,
        oneTimeOriginalAmount: 1000000.00,
        oneTimeCurrency: "ARS",
        oneTimeExchangeRate: 810.000000,
        oneTimeAmountUsd: 1234.567901,
      },
    });
    expect(proj.id).toBeDefined();
  });

  it("25. rechaza Project one-time ARS con USD inconsistente", async () => {
    const client2 = await prisma.client.create({ data: { name: `${prefix}Test Client OneTime ARS Bad` } });
    await expectRejected(
      prisma.project.create({
        data: {
          clientId: client2.id,
          name: `${prefix}OneTime ARS Bad`,
          oneTimeOriginalAmount: 1000000.00,
          oneTimeCurrency: "ARS",
          oneTimeExchangeRate: 810.000000,
          oneTimeAmountUsd: 1200.000000,  // correcto: ~1234.567901, diferencia ~34 >> 0.00001
        },
      }),
      "Project one-time ARS inconsistente",
    );
  });

  it("26. acepta Project one-time USD valido", async () => {
    const client2 = await prisma.client.create({ data: { name: `${prefix}Test Client OneTime USD` } });
    const proj = await prisma.project.create({
      data: {
        clientId: client2.id,
        name: `${prefix}OneTime USD Valid`,
        oneTimeOriginalAmount: 5000.000000,
        oneTimeCurrency: "USD",
        oneTimeAmountUsd: 5000.000000,
      },
    });
    expect(proj.id).toBeDefined();
    expect(proj.oneTimeExchangeRate).toBeNull();
  });

  // --- Monetary consistency: Project monthly ---

  it("27. acepta Project monthly ARS valido", async () => {
    const client2 = await prisma.client.create({ data: { name: `${prefix}Test Client Monthly ARS` } });
    const proj = await prisma.project.create({
      data: {
        clientId: client2.id,
        name: `${prefix}Monthly ARS Valid`,
        monthlyRecurringOriginalAmount: 200000.00,
        monthlyRecurringCurrency: "ARS",
        monthlyRecurringExchangeRate: 810.000000,
        monthlyRecurringAmountUsd: 246.913580,
      },
    });
    expect(proj.id).toBeDefined();
  });

  it("28. rechaza Project monthly ARS inconsistente", async () => {
    const client2 = await prisma.client.create({ data: { name: `${prefix}Test Client Monthly ARS Bad` } });
    await expectRejected(
      prisma.project.create({
        data: {
          clientId: client2.id,
          name: `${prefix}Monthly ARS Bad`,
          monthlyRecurringOriginalAmount: 200000.00,
          monthlyRecurringCurrency: "ARS",
          monthlyRecurringExchangeRate: 810.000000,
          monthlyRecurringAmountUsd: 240.000000,  // correcto: ~246.913580, diferencia ~6.9 >> 0.00001
        },
      }),
      "Project monthly ARS inconsistente",
    );
  });

  it("29. acepta Project monthly USD valido", async () => {
    const client2 = await prisma.client.create({ data: { name: `${prefix}Test Client Monthly USD` } });
    const proj = await prisma.project.create({
      data: {
        clientId: client2.id,
        name: `${prefix}Monthly USD Valid`,
        monthlyRecurringOriginalAmount: 950.000000,
        monthlyRecurringCurrency: "USD",
        monthlyRecurringAmountUsd: 950.000000,
      },
    });
    expect(proj.id).toBeDefined();
    expect(proj.monthlyRecurringExchangeRate).toBeNull();
  });
});
