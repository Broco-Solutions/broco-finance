import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

const TABLE = "project_share_links";

async function tableExists(name: string) {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_name = '${name}'`,
  );
  return r.length > 0;
}
async function columnExists(table: string, col: string) {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT column_name AS t FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col}'`,
  );
  return r.length > 0;
}
async function columnIsNotNull(table: string, col: string) {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT is_nullable AS t FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${col}'`,
  );
  return r.length > 0 && r[0].t === "NO";
}
async function indexExists(name: string) {
  const r = await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT indexname AS t FROM pg_indexes WHERE indexname = '${name}'`,
  );
  return r.length > 0;
}
async function rowCount() {
  const rows = await prisma.$queryRawUnsafe<[{ c: string }]>(
    `SELECT COUNT(*)::text AS c FROM "${TABLE}"`,
  );
  return Number(rows[0].c);
}

export async function GET() {
  if (!isAuthenticated()) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const hasTable = await tableExists(TABLE);
  if (!hasTable) {
    return Response.json({ hasTable: false });
  }
  const hasTokenHash = await columnExists(TABLE, "token_hash");
  const hasSlug = await columnExists(TABLE, "slug");
  const hasPasswordHash = await columnExists(TABLE, "password_hash");
  const hasPasswordEncrypted = await columnExists(TABLE, "password_encrypted");
  const hasAccessVersion = await columnExists(TABLE, "access_version");
  const hasUpdatedAt = await columnExists(TABLE, "updated_at");
  const hasRevokedAt = await columnExists(TABLE, "revoked_at");
  const slugNotNull = hasSlug ? await columnIsNotNull(TABLE, "slug") : false;
  const pwdHashNotNull = hasPasswordHash ? await columnIsNotNull(TABLE, "password_hash") : false;
  const pwdEncNotNull = hasPasswordEncrypted ? await columnIsNotNull(TABLE, "password_encrypted") : false;
  const hasIdxSlug = await indexExists("project_share_links_slug_key");
  const hasIdxToken = await indexExists("project_share_links_token_hash_key");
  const count = await rowCount();
  // check V1.1 present
  const v11Cols = ["slug", "password_hash", "password_encrypted", "access_version", "updated_at"];
  let v11Present = true;
  for (const c of v11Cols) if (!(await columnExists(TABLE, c))) v11Present = false;

  return Response.json({
    hasTable,
    rowCount: count,
    columns: {
      token_hash: hasTokenHash,
      slug: hasSlug,
      password_hash: hasPasswordHash,
      password_encrypted: hasPasswordEncrypted,
      access_version: hasAccessVersion,
      updated_at: hasUpdatedAt,
      revoked_at: hasRevokedAt,
    },
    notNull: {
      slug: slugNotNull,
      password_hash: pwdHashNotNull,
      password_encrypted: pwdEncNotNull,
    },
    indexes: {
      slug_key: hasIdxSlug,
      token_hash_key: hasIdxToken,
    },
    v11Present,
  });
}

export async function POST() {
  if (!isAuthenticated()) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const hasTable = await tableExists(TABLE);
  if (!hasTable) {
    return Response.json({ error: "no table" }, { status: 500 });
  }
  const v11Cols = ["slug", "password_hash", "password_encrypted", "access_version", "updated_at"];
  for (const c of v11Cols) {
    if (!(await columnExists(TABLE, c))) {
      return Response.json({ error: `missing V1.1 column ${c}` }, { status: 500 });
    }
  }
  if (!(await columnIsNotNull(TABLE, "slug"))) {
    return Response.json({ error: "slug not NOT NULL" }, { status: 500 });
  }
  if (!(await indexExists("project_share_links_slug_key"))) {
    return Response.json({ error: "missing slug index" }, { status: 500 });
  }
  const hasTokenHash = await columnExists(TABLE, "token_hash");
  if (!hasTokenHash) {
    return Response.json({ status: "SKIP", message: "legacy token_hash ya eliminado" });
  }
  // cleanup steps (one statement per call as required by Accelerate)
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "project_share_links_token_hash_key"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "token_hash"`);

  const afterHasToken = await columnExists(TABLE, "token_hash");
  const count = await rowCount();
  return Response.json({
    status: "CLEANUP_COMPLETED",
    rowCount: count,
    token_hash_after: afterHasToken,
  });
}
