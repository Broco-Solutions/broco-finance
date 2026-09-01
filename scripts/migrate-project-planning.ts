import { PrismaClient } from "@prisma/client";

const url = process.env.PRISMA_DATABASE_URL;
if (!url) {
  console.error("Falta PRISMA_DATABASE_URL (no se ejecuta contra produccion en esta etapa).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const STEP = async (label: string, sql: string) => {
  console.log(`--- ${label}`);
  await prisma.$executeRawUnsafe(sql);
  console.log("OK");
};

async function enumExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT typname AS t FROM pg_type WHERE typname = '${name}'`,
  );
  return r.length > 0;
}

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

async function indexExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT indexname AS t FROM pg_indexes WHERE indexname = '${name}'`,
  );
  return r.length > 0;
}

async function fkExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT constraint_name AS t FROM information_schema.table_constraints WHERE constraint_name = '${name}'`,
  );
  return r.length > 0;
}

async function ensureEnum(name: string, values: string[], label: string) {
  if (await enumExists(name)) {
    console.log(`SKIP ${label}: enum ya existe`);
    return;
  }
  await STEP(label, `CREATE TYPE "${name}" AS ENUM (${values.map((v) => `'${v}'`).join(", ")})`);
}

async function ensureColumn(table: string, col: string, sql: string, label: string) {
  if (await columnExists(table, col)) {
    console.log(`SKIP ${label}: columna ya existe`);
    return;
  }
  await STEP(label, sql);
}

async function ensureTable(name: string, sql: string, label: string) {
  if (await tableExists(name)) {
    console.log(`SKIP ${label}: tabla ya existe`);
    return;
  }
  await STEP(label, sql);
}

async function ensureIndex(name: string, sql: string, label: string) {
  if (await indexExists(name)) {
    console.log(`SKIP ${label}: indice ya existe`);
    return;
  }
  await STEP(label, sql);
}

async function ensureFk(name: string, sql: string, label: string) {
  if (await fkExists(name)) {
    console.log(`SKIP ${label}: FK ya existe`);
    return;
  }
  await STEP(label, sql);
}

async function main() {
  if (!(await tableExists("projects"))) {
    console.error("ABORTO: la tabla projects no existe. Revisar estado de la base.");
    process.exit(1);
  }

  await ensureEnum("ProjectTaskType", ["TASK", "MILESTONE"], "1. Enum ProjectTaskType");
  await ensureEnum(
    "ProjectTaskStatus",
    ["TODO", "IN_PROGRESS", "TO_REVIEW", "BLOCKED", "DONE"],
    "2. Enum ProjectTaskStatus",
  );

  await ensureColumn(
    "projects",
    "go_live_date",
    `ALTER TABLE "projects" ADD COLUMN "go_live_date" DATE`,
    "3. projects.go_live_date",
  );

  await ensureTable(
    "project_phases",
    `CREATE TABLE "project_phases" (
      "id" UUID NOT NULL,
      "project_id" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "position" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
    )`,
    "4. Tabla project_phases",
  );

  await ensureIndex(
    "project_phases_project_id_position_idx",
    `CREATE INDEX "project_phases_project_id_position_idx" ON "project_phases"("project_id", "position")`,
    "5. Indice project_phases(project_id, position)",
  );

  await ensureTable(
    "project_tasks",
    `CREATE TABLE "project_tasks" (
      "id" UUID NOT NULL,
      "project_id" UUID NOT NULL,
      "phase_id" UUID,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "type" "ProjectTaskType" NOT NULL DEFAULT 'TASK',
      "start_date" DATE NOT NULL,
      "end_date" DATE NOT NULL,
      "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
      "position" INTEGER NOT NULL DEFAULT 0,
      "client_visible" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
    )`,
    "6. Tabla project_tasks",
  );

  await ensureIndex(
    "project_tasks_project_id_phase_id_position_idx",
    `CREATE INDEX "project_tasks_project_id_phase_id_position_idx" ON "project_tasks"("project_id", "phase_id", "position")`,
    "7a. Indice project_tasks(project_id, phase_id, position)",
  );

  await ensureIndex(
    "project_tasks_project_id_status_idx",
    `CREATE INDEX "project_tasks_project_id_status_idx" ON "project_tasks"("project_id", "status")`,
    "7b. Indice project_tasks(project_id, status)",
  );

  await ensureTable(
    "project_share_links",
    `CREATE TABLE "project_share_links" (
      "id" UUID NOT NULL,
      "project_id" UUID NOT NULL,
      "token_hash" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "revoked_at" TIMESTAMP(3),
      CONSTRAINT "project_share_links_pkey" PRIMARY KEY ("id")
    )`,
    "8. Tabla project_share_links",
  );

  await ensureIndex(
    "project_share_links_project_id_key",
    `CREATE UNIQUE INDEX "project_share_links_project_id_key" ON "project_share_links"("project_id")`,
    "9a. Unique project_share_links(project_id)",
  );

  await ensureIndex(
    "project_share_links_token_hash_key",
    `CREATE UNIQUE INDEX "project_share_links_token_hash_key" ON "project_share_links"("token_hash")`,
    "9b. Unique project_share_links(token_hash)",
  );

  await ensureFk(
    "project_phases_project_id_fkey",
    `ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    "10a. FK project_phases.project_id",
  );

  await ensureFk(
    "project_tasks_project_id_fkey",
    `ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    "10b. FK project_tasks.project_id",
  );

  await ensureFk(
    "project_tasks_phase_id_fkey",
    `ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    "10c. FK project_tasks.phase_id",
  );

  await ensureFk(
    "project_share_links_project_id_fkey",
    `ALTER TABLE "project_share_links" ADD CONSTRAINT "project_share_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    "10d. FK project_share_links.project_id",
  );

  console.log("\n=== MIGRACION PROJECT PLANNING COMPLETADA (o ya aplicada) ===");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
