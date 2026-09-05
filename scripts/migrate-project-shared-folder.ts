import { PrismaClient } from "@prisma/client";

const url = process.env.PRISMA_DATABASE_URL;
if (!url) {
  console.error("Falta PRISMA_DATABASE_URL (no se ejecuta contra produccion en esta etapa).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const TABLE = "projects";

const COLUMNS = ["client_shared_folder_url", "client_shared_folder_label"];

async function tableExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_name = '${name}'`,
  );
  return r.length > 0;
}

async function columnExists(table: string, col: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT column_name AS t FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col}'`,
  );
  return r.length > 0;
}

async function main() {
  console.log("== MIGRACION: project shared folder ==");

  if (!(await tableExists(TABLE))) {
    console.error(`ABORTO: no existe la tabla ${TABLE}.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const missing = [];
  for (const col of COLUMNS) {
    if (!(await columnExists(TABLE, col))) missing.push(col);
  }

  if (missing.length === 0) {
    console.log(`SKIP: las columnas ${COLUMNS.join(", ")} ya existen en ${TABLE}.`);
    await prisma.$disconnect();
    return;
  }

  for (const col of missing) {
    console.log(`--- add column ${col} (nullable, sin datos existentes modificados)`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${col}" TEXT`,
    );
    console.log("OK");
  }

  console.log("\n=== APPLIED ===");
  console.log(`Columnas agregadas: ${missing.join(", ")} (nullable TEXT).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
