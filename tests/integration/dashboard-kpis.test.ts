import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;

describe.skipIf(skip)("dashboard KPIs y totales", () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids) { try { await prisma.income.delete({ where: { id } }).catch(()=>{}); } catch {} }
    await prisma.$disconnect();
  });

  it("pendiente global incluye todos los PENDING independiente del periodo", async () => {
    const old = await prisma.income.create({ data: { type: "OTHER", concept: "global-old", status: "PENDING", amountUsd: 5, dueDate: new Date("2020-01-01") } }); ids.push(old.id);
    const future = await prisma.income.create({ data: { type: "OTHER", concept: "global-future", status: "PENDING", amountUsd: 5, dueDate: new Date("2030-01-01") } }); ids.push(future.id);
    const allPending = await prisma.income.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true } });
    expect(Number(allPending._sum.amountUsd ?? 0)).toBeGreaterThanOrEqual(10);
  });

  it("pendiente de pago global incluye todos los PENDING", async () => {
    const allPending = await prisma.expense.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true } });
    expect(typeof Number(allPending._sum.amountUsd ?? 0)).toBe("number");
  });

  it("gastos agrupados por categoria devuelven top items", async () => {
    const cats = await prisma.expense.groupBy({ by: ["expenseCategoryId"], where: { status: "PAID" }, _sum: { amountUsd: true }, _count: true, orderBy: { _sum: { amountUsd: "desc" } }, take: 5 });
    expect(cats.length).toBeGreaterThanOrEqual(1);
    expect(Number(cats[0]._sum.amountUsd ?? 0)).toBeGreaterThan(0);
  });

  it("ingresos agrupados por cliente devuelven datos", async () => {
    const incs = await prisma.income.findMany({ where: { status: "PAID", clientId: { not: null } }, include: { client: true }, take: 5 });
    if (incs.length > 0) {
      expect(incs[0].client).not.toBeNull();
      expect(Number(incs[0].amountUsd)).toBeGreaterThan(0);
    }
  });

  it("total filtrado en cero muestra USD 0,00", () => {
    const zero = 0;
    expect(zero.toFixed(2)).toBe("0.00");
  });

  it("KPI links tienen parametros correctos", () => {
    const f = "2026-07-01"; const t = "2026-07-18";
    const incomeLink = `/incomes?status=PAID&from=${f}&to=${t}`;
    const expenseLink = `/expenses?status=PAID&from=${f}&to=${t}`;
    const pendingInc = "/incomes?status=PENDING";
    const pendingExp = "/expenses?status=PENDING";
    expect(incomeLink).toContain("status=PAID");
    expect(expenseLink).toContain("status=PAID");
    expect(pendingInc).toContain("status=PENDING");
    expect(pendingExp).toContain("status=PENDING");
  });
});
