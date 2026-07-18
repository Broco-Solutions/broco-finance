import { PrismaClient } from "@prisma/client";
import {
  seedClients,
  seedProjects,
  seedCategories,
  seedIncomes,
  seedExpenses,
} from "./seed-data";

const prodDbUrl = process.env.DATABASE_URL;
const testDbUrl = process.env.DATABASE_URL_TEST;

function requireTestEnv() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("NODE_ENV debe ser test para ejecutar el seed.");
  }
  if (process.env.ALLOW_DESTRUCTIVE_TEST_DB !== "true") {
    throw new Error("ALLOW_DESTRUCTIVE_TEST_DB debe ser true.");
  }
  if (!testDbUrl) {
    throw new Error("DATABASE_URL_TEST no esta definida.");
  }
  if (!prodDbUrl) {
    throw new Error("DATABASE_URL no esta definida.");
  }
  if (testDbUrl === prodDbUrl) {
    throw new Error("DATABASE_URL_TEST y DATABASE_URL deben ser distintas.");
  }
}

async function main() {
  requireTestEnv();

  const prisma = new PrismaClient({
    datasources: { db: { url: testDbUrl! } },
  });

  console.log("Iniciando seed canonico en:", testDbUrl!.replace(/\/\/.*@/, "//***:***@"));

  await prisma.$transaction(async (tx) => {
    console.log("Limpiando tablas...");
    await tx.expense.deleteMany();
    await tx.income.deleteMany();
    await tx.project.deleteMany();
    await tx.expenseCategory.deleteMany();
    await tx.client.deleteMany();

    console.log("Creando categorias:", seedCategories.length);
    for (const cat of seedCategories) {
      await tx.expenseCategory.create({
        data: { id: cat.id, name: cat.name, isActive: true },
      });
    }

    console.log("Creando clientes:", seedClients.length);
    for (const cl of seedClients) {
      await tx.client.create({
        data: {
          id: cl.id,
          name: cl.name,
          contactName: cl.contact,
          contactEmail: null,
          contactPhone: null,
          notes: null,
        },
      });
    }

    console.log("Creando proyectos:", seedProjects.length);
    for (const proj of seedProjects) {
      await tx.project.create({
        data: {
          id: proj.id,
          clientId: proj.clientId,
          name: proj.name,
          isActive: proj.isActive,
        },
      });
    }

    console.log("Creando ingresos:", seedIncomes.length);
    for (const inc of seedIncomes) {
      await tx.income.create({
        data: {
          id: inc.id,
          clientId: inc.clientId,
          projectId: inc.projectId,
          type: inc.type as "DEVELOPMENT" | "MAINTENANCE" | "OTHER",
          concept: inc.concept,
          notes: inc.notes,
          status: "PAID",
          amountUsd: inc.amountUsd,
          amountArs: inc.amountArs,
          exchangeRate: inc.exchangeRate,
          effectiveDate: new Date(inc.effectiveDate),
        },
      });
    }

    console.log("Creando gastos:", seedExpenses.length);
    for (const exp of seedExpenses) {
      await tx.expense.create({
        data: {
          id: exp.id,
          expenseCategoryId: exp.expenseCategoryId,
          projectId: exp.projectId,
          type: exp.type as "FIXED" | "VARIABLE",
          concept: exp.concept,
          notes: exp.notes,
          status: "PAID",
          amountUsd: exp.amountUsd,
          amountArs: exp.amountArs,
          exchangeRate: exp.exchangeRate,
          effectiveDate: new Date(exp.effectiveDate),
        },
      });
    }
  });

  const [clients, projects, categories, incomes, expenses] = await Promise.all([
    prisma.client.count(),
    prisma.project.count(),
    prisma.expenseCategory.count(),
    prisma.income.count(),
    prisma.expense.count(),
  ]);

  console.log("\n=== SEED COMPLETADO ===");
  console.log("Clientes:", clients);
  console.log("Proyectos:", projects);
  console.log("Categorias:", categories);
  console.log("Ingresos:", incomes);
  console.log("Gastos:", expenses);

  const totalIncomeUsd = await prisma.income.aggregate({ _sum: { amountUsd: true } });
  const totalExpenseUsd = await prisma.expense.aggregate({ _sum: { amountUsd: true } });
  console.log("Total USD ingresos:", totalIncomeUsd._sum.amountUsd?.toString() ?? "0");
  console.log("Total USD gastos:", totalExpenseUsd._sum.amountUsd?.toString() ?? "0");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Seed fallo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
