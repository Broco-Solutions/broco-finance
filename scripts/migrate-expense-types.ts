/**
 * Migración: convertir a VARIABLE los gastos de categorías
 * DOMIIOS, HERRAMIENTAS e INFRAESTRUCTURA Y HOSTING.
 *
 * Uso:
 *   DATABASE_URL="postgresql://usuario:pass@host:5432/broco_finance" npx tsx scripts/migrate-expense-types.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categoryNames = ["DOMIIOS", "HERRAMIENTAS", "INFRAESTRUCTURA Y HOSTING"];

  // 1. Buscar categorías
  const categories = await prisma.expenseCategory.findMany({
    where: { name: { in: categoryNames } },
  });

  if (categories.length === 0) {
    console.log("No se encontraron las categorías:", categoryNames.join(", "));
    console.log("Verificá que los nombres coincidan exactamente.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Categorías encontradas (${categories.length}):`);
  for (const c of categories) {
    console.log(`  - ${c.name} (${c.id})`);
  }

  const catIds = categories.map((c) => c.id);

  // 2. Contar gastos FIXED que se van a actualizar
  const fixedCount = await prisma.expense.count({
    where: { expenseCategoryId: { in: catIds }, type: "FIXED" },
  });

  console.log(`\nGastos FIXED que se convertirán a VARIABLE: ${fixedCount}`);

  if (fixedCount === 0) {
    console.log("Nada que actualizar.");
    await prisma.$disconnect();
    return;
  }

  // 3. Ejecutar actualización
  const result = await prisma.expense.updateMany({
    where: { expenseCategoryId: { in: catIds }, type: "FIXED" },
    data: { type: "VARIABLE" },
  });

  console.log(`✅ Actualizados: ${result.count} gastos.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
