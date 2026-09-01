import { PrismaClient } from "@prisma/client";

const url = process.env.PRISMA_DATABASE_URL;
if (!url) {
  console.error("Falta PRISMA_DATABASE_URL (no se ejecuta contra produccion en esta etapa).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const TABLE = "project_share_links";

const STEP = async (label: string, sql: string) => {
  console.log(`--- ${label}`);
  await prisma.$executeRawUnsafe(sql);
  console.log("OK");
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function columnIsNotNull(table: string, col: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT is_nullable AS t FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col}'`,
  );
  return r.length > 0 && r[0].t === "NO";
}

async function indexExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT indexname AS t FROM pg_indexes WHERE indexname = '${name}'`,
  );
  return r.length > 0;
}

const V1_1_COLUMNS = ["slug", "password_hash", "password_encrypted", "access_version", "updated_at"];

async function areV11ColumnsPresent(): Promise<boolean> {
  for (const col of V1_1_COLUMNS) {
    if (!(await columnExists(TABLE, col))) return false;
  }
  return true;
}

async function isPrepareApplied(): Promise<boolean> {
  if (!(await areV11ColumnsPresent())) return false;
  if (!(await columnIsNotNull(TABLE, "slug"))) return false;
  if (!(await columnIsNotNull(TABLE, "password_hash"))) return false;
  if (!(await columnIsNotNull(TABLE, "password_encrypted"))) return false;
  if (!(await indexExists("project_share_links_slug_key"))) return false;
  return true;
}

async function rowCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ c: string }]>(
    `SELECT COUNT(*)::text AS c FROM "${TABLE}"`,
  );
  return Number(rows[0].c);
}

// ---------------------------------------------------------------------------
// FASE PREPARE — agrega V1.1 conservando token_hash
// ---------------------------------------------------------------------------

async function runPrepare() {
  console.log("== FASE PREPARE ==");

  if (!(await tableExists(TABLE))) {
    console.error(`ABORTO: no existe la tabla ${TABLE}.`);
    process.exit(1);
  }

  const hasTokenHash = await columnExists(TABLE, "token_hash");
  const prepareApplied = await isPrepareApplied();

  if (prepareApplied) {
    console.log(`SKIP: schema V1.1 (prepare) ya aplicado en ${TABLE}.`);
    await prisma.$disconnect();
    return;
  }

  if (hasTokenHash) {
    const count = await rowCount();
    if (count > 0) {
      console.error(
        `ABORTO: schema legacy con ${count} fila(s) en ${TABLE}. No se destruyen datos; requiere decisión manual.`,
      );
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  // Columnas V1.1 (idempotentes)
  await STEP(
    "add column slug",
    `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "slug" TEXT`,
  );
  await STEP(
    "add column password_hash",
    `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "password_hash" TEXT`,
  );
  await STEP(
    "add column password_encrypted",
    `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "password_encrypted" TEXT`,
  );
  await STEP(
    "add column access_version",
    `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "access_version" INTEGER NOT NULL DEFAULT 0`,
  );
  await STEP(
    "add column updated_at",
    `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL`,
  );
  await STEP(
    "unique index slug",
    `CREATE UNIQUE INDEX IF NOT EXISTS "project_share_links_slug_key" ON "${TABLE}"("slug")`,
  );
  await STEP("set slug NOT NULL", `ALTER TABLE "${TABLE}" ALTER COLUMN "slug" SET NOT NULL`);
  await STEP(
    "set password_hash NOT NULL",
    `ALTER TABLE "${TABLE}" ALTER COLUMN "password_hash" SET NOT NULL`,
  );
  await STEP(
    "set password_encrypted NOT NULL",
    `ALTER TABLE "${TABLE}" ALTER COLUMN "password_encrypted" SET NOT NULL`,
  );
  if (hasTokenHash) {
    await STEP(
      "make token_hash nullable for dual period",
      `ALTER TABLE "${TABLE}" ALTER COLUMN "token_hash" DROP NOT NULL`,
    );
  }

  console.log(`\n=== PREPARE COMPLETADO ===`);
  console.log(`V1.1 agregado; token_hash conservado para compatibilidad con V1.0.`);
  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// FASE CLEANUP — elimina legacy token_hash
// ---------------------------------------------------------------------------

async function runCleanup() {
  console.log("== FASE CLEANUP ==");

  if (!(await tableExists(TABLE))) {
    console.error(`ABORTO: no existe la tabla ${TABLE}.`);
    process.exit(1);
  }

  if (!(await areV11ColumnsPresent())) {
    console.error(
      `ABORTO: faltan columnas V1.1 en ${TABLE}. No se puede eliminar token_hash sin V1.1.`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  if (!(await columnIsNotNull(TABLE, "slug"))) {
    console.error(`ABORTO: columna slug no es NOT NULL en ${TABLE}. V1.1 incompleto.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  if (!(await indexExists("project_share_links_slug_key"))) {
    console.error(`ABORTO: falta índice único de slug en ${TABLE}.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const hasTokenHash = await columnExists(TABLE, "token_hash");
  if (!hasTokenHash) {
    console.log(`SKIP: legacy token_hash ya eliminado en ${TABLE}.`);
    await prisma.$disconnect();
    return;
  }

  await STEP(
    "cleanup: drop unique index token_hash",
    `DROP INDEX IF EXISTS "project_share_links_token_hash_key"`,
  );
  await STEP(
    "cleanup: drop column token_hash",
    `ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "token_hash"`,
  );

  console.log(`\n=== CLEANUP COMPLETADO ===`);
  console.log(`Legacy token_hash eliminado; schema final == prisma/schema.prisma.`);
  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const hasPrepare = args.includes("--prepare");
  const hasCleanup = args.includes("--cleanup");

  if (hasPrepare && hasCleanup) {
    console.error("Uso: --prepare o --cleanup (no ambos).");
    process.exit(1);
  }
  if (hasPrepare) return runPrepare();
  if (hasCleanup) return runCleanup();

  console.error("Uso: pnpm exec tsx scripts/migrate-project-share-v1-1.ts --prepare|--cleanup");
  process.exit(1);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
