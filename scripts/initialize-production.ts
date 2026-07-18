import { PrismaClient } from "@prisma/client";
import {
  seedClients,
  seedProjects,
  seedCategories,
  seedIncomes,
  seedExpenses,
} from "../prisma/seed-data";

function requireProductionInit() {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("NODE_ENV debe ser production.");
  }
  if (process.env.ALLOW_PRODUCTION_INITIALIZE !== "true") {
    throw new Error("ALLOW_PRODUCTION_INITIALIZE debe ser true.");
  }
  if (process.env.CONFIRM_PRODUCTION_INITIALIZE !== "broco-finance") {
    throw new Error("CONFIRM_PRODUCTION_INITIALIZE debe ser broco-finance.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no esta definida.");
  }
}

async function main() {
  requireProductionInit();

  const prisma = new PrismaClient();

  // Verify base is empty
  const counts = await Promise.all([
    prisma.client.count(),
    prisma.project.count(),
    prisma.expenseCategory.count(),
    prisma.income.count(),
    prisma.expense.count(),
  ]);
  const [cCli, cProj, cCat, cInc, cExp] = counts;

  if (cCli + cProj + cCat + cInc + cExp > 0) {
    console.error("LA BASE NO ESTA VACIA. Inicializacion abortada.");
    console.error("Clientes:", cCli, "Proyectos:", cProj, "Categorias:", cCat, "Ingresos:", cInc, "Gastos:", cExp);
    process.exit(1);
  }

  console.log("Base vacia confirmada. Iniciando inicializacion productiva...");

  await prisma.$transaction(async (tx) => {
    console.log("Creando categorias:", seedCategories.length);
    for (const cat of seedCategories) {
      await tx.expenseCategory.create({ data: { id: cat.id, name: cat.name, isActive: true } });
    }

    console.log("Creando clientes:", seedClients.length);
    for (const cl of seedClients) {
      await tx.client.create({
        data: { id: cl.id, name: cl.name, contactName: cl.contact, contactEmail: null, contactPhone: null, notes: null },
      });
    }

    console.log("Creando proyectos:", seedProjects.length);
    for (const proj of seedProjects) {
      await tx.project.create({ data: { id: proj.id, clientId: proj.clientId, name: proj.name, isActive: proj.isActive } });
    }

    console.log("Creando ingresos:", seedIncomes.length);
    for (const inc of seedIncomes) {
      await tx.income.create({
        data: {
          id: inc.id, clientId: inc.clientId, projectId: inc.projectId,
          type: inc.type as "DEVELOPMENT" | "MAINTENANCE" | "OTHER",
          concept: inc.concept, notes: inc.notes, status: "PAID",
          amountUsd: inc.amountUsd, amountArs: inc.amountArs, exchangeRate: inc.exchangeRate,
          effectiveDate: new Date(inc.effectiveDate),
        },
      });
    }

    console.log("Creando gastos:", seedExpenses.length);
    for (const exp of seedExpenses) {
      await tx.expense.create({
        data: {
          id: exp.id, expenseCategoryId: exp.expenseCategoryId, projectId: exp.projectId,
          type: exp.type as "FIXED" | "VARIABLE", concept: exp.concept, notes: exp.notes, status: "PAID",
          amountUsd: exp.amountUsd, amountArs: exp.amountArs, exchangeRate: exp.exchangeRate,
          effectiveDate: new Date(exp.effectiveDate),
        },
      });
    }

    // Verify within transaction
    const final = await Promise.all([
      tx.client.count(), tx.project.count(), tx.expenseCategory.count(),
      tx.income.count(), tx.expense.count(),
    ]);

    if (final[0] !== 13 || final[1] !== 18 || final[2] !== 14 || final[3] !== 45 || final[4] !== 79) {
      throw new Error(`Conteos incorrectos: Cli=${final[0]} Proj=${final[1]} Cat=${final[2]} Inc=${final[3]} Exp=${final[4]}`);
    }
  });

  // Final verification
  const [fcCli, fcProj, fcCat, fcInc, fcExp] = await Promise.all([
    prisma.client.count(), prisma.project.count(), prisma.expenseCategory.count(),
    prisma.income.count(), prisma.expense.count(),
  ]);

  const [incSummary] = await prisma.$queryRawUnsafe<[{ ars: string; usd: string }]>(
    "SELECT COALESCE(SUM(amount_ars),0)::text as ars, ROUND(COALESCE(SUM(amount_usd),0),2)::text as usd FROM incomes",
  );
  const [expSummary] = await prisma.$queryRawUnsafe<[{ ars: string; usd: string }]>(
    "SELECT COALESCE(SUM(amount_ars),0)::text as ars, ROUND(COALESCE(SUM(amount_usd),0),2)::text as usd FROM expenses",
  );

  console.log("\n=== INICIALIZACION PRODUCTIVA COMPLETADA ===");
  console.log("Clientes:", fcCli, "Proyectos:", fcProj, "Categorias:", fcCat, "Ingresos:", fcInc, "Gastos:", fcExp);
  console.log("Ingresos ARS:", incSummary.ars, "USD:", incSummary.usd);
  console.log("Gastos ARS:", expSummary.ars, "USD:", expSummary.usd);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Inicializacion fallo:", e instanceof Error ? e.message : e);
  process.exit(1);
});
