import { PrismaClient } from "@prisma/client";

const url = process.env.PRISMA_DATABASE_URL;
if (!url) { console.error("Falta PRISMA_DATABASE_URL"); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url } } });

const STEP = async (label: string, sql: string) => {
  console.log(`--- ${label}`);
  await prisma.$executeRawUnsafe(sql);
  console.log("OK");
};

async function main() {
  // Pre-verificación
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_name='incomes' AND column_name IN ('type_id','income_type')"
  );
  if (!cols.some(c => c.column_name === "income_type")) {
    console.error("ABORTO: la columna income_type no existe. Revisar estado.");
    process.exit(1);
  }
  const typesExist = await prisma.$queryRawUnsafe<{ c: string }[]>(
    "SELECT COUNT(*)::text as c FROM information_schema.tables WHERE table_name='income_types'"
  );
  if (typesExist[0].c === "1") {
    console.error("ABORTO: la tabla income_types YA existe. No se puede repetir la migracion.");
    process.exit(1);
  }

  await STEP("1a. Crear tabla income_types",
    `CREATE TABLE "income_types" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "requires_project" BOOLEAN NOT NULL DEFAULT false, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "income_types_pkey" PRIMARY KEY ("id"))`
  );
  await STEP("1b. Unique index",
    `CREATE UNIQUE INDEX "income_types_name_key" ON "income_types"("name")`
  );

  await STEP("2a. Seed Desarrollo",
    `INSERT INTO "income_types" (id, name, requires_project, is_active, created_at, updated_at) SELECT gen_random_uuid(), 'Desarrollo', true, true, NOW(), NOW()`
  );
  await STEP("2b. Seed Mantenimiento",
    `INSERT INTO "income_types" (id, name, requires_project, is_active, created_at, updated_at) SELECT gen_random_uuid(), 'Mantenimiento', true, true, NOW(), NOW()`
  );
  await STEP("2c. Seed Otro",
    `INSERT INTO "income_types" (id, name, requires_project, is_active, created_at, updated_at) SELECT gen_random_uuid(), 'Otro', false, true, NOW(), NOW()`
  );

  await STEP("3. Agregar columna type_id",
    `ALTER TABLE "incomes" ADD COLUMN "type_id" UUID`
  );

  await STEP("4a. Mapear DEVELOPMENT",
    `UPDATE "incomes" SET "type_id" = (SELECT id FROM "income_types" WHERE name = 'Desarrollo') WHERE "income_type" = 'DEVELOPMENT'`
  );
  await STEP("4b. Mapear MAINTENANCE",
    `UPDATE "incomes" SET "type_id" = (SELECT id FROM "income_types" WHERE name = 'Mantenimiento') WHERE "income_type" = 'MAINTENANCE'`
  );
  await STEP("4c. Mapear OTHER",
    `UPDATE "incomes" SET "type_id" = (SELECT id FROM "income_types" WHERE name = 'Otro') WHERE "income_type" = 'OTHER'`
  );

  const nulls = await prisma.$queryRawUnsafe<[{ c: string }]>(
    "SELECT COUNT(*)::text as c FROM \"incomes\" WHERE \"type_id\" IS NULL"
  );
  if (nulls[0].c !== "0") {
    console.error(`ABORTO: hay ${nulls[0].c} ingresos sin type_id mapeado.`);
    process.exit(1);
  }
  console.log("Verificacion NULLs: OK (0 pendientes)");

  await STEP("6a. SET NOT NULL",
    `ALTER TABLE "incomes" ALTER COLUMN "type_id" SET NOT NULL`
  );
  await STEP("6b. FK",
    `ALTER TABLE "incomes" ADD CONSTRAINT "incomes_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "income_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await STEP("6c. Index",
    `CREATE INDEX "incomes_type_id_idx" ON "incomes"("type_id")`
  );

  await STEP("7. Dropear columna income_type",
    `ALTER TABLE "incomes" DROP COLUMN "income_type"`
  );

  try {
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "IncomeType"`);
    console.log("Enum IncomeType eliminado");
  } catch (e: any) {
    console.log("Enum IncomeType: skip:", e.message?.slice(0, 80));
  }

  const final = await prisma.$queryRawUnsafe<[{ total: string; tipos: string }]>(
    `SELECT (SELECT COUNT(*)::text FROM "incomes") as total, (SELECT COUNT(*)::text FROM "income_types") as tipos`
  );
  const dist = await prisma.$queryRawUnsafe<{ name: string; c: string }[]>(
    `SELECT it.name, COUNT(i.id)::text as c FROM "income_types" it LEFT JOIN "incomes" i ON i."type_id" = it.id GROUP BY it.name ORDER BY it.name`
  );
  console.log("\n=== MIGRACION COMPLETADA ===");
  console.log("Total incomes:", final[0].total, "| Tipos:", final[0].tipos);
  for (const d of dist) console.log(`  ${d.name}: ${d.c}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });