import { Prisma, PrismaClient } from "@prisma/client";

type GlobalForPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

type ResolvedDatabaseConfig = {
  url: string;
  host: string | null;
  protocol: string | null;
  sslmode: string | null;
  connectTimeout: string | null;
  isPrismaPostgresTcp: boolean;
  usesPooledTcp: boolean;
  wasRewrittenToPooled: boolean;
};

const prismaLogLevels: Prisma.LogLevel[] = ["query", "error", "warn"];

function resolveDatabaseConfig(rawUrl = process.env.DATABASE_URL): ResolvedDatabaseConfig | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    const isTcpPostgres = url.protocol === "postgres:" || url.protocol === "postgresql:";
    const isPrismaPostgresTcp = isTcpPostgres && (url.hostname === "db.prisma.io" || url.hostname === "pooled.db.prisma.io");
    const shouldPreferPooledTcp = isPrismaPostgresTcp && url.hostname === "db.prisma.io" && Boolean(process.env.VERCEL);

    if (shouldPreferPooledTcp) {
      url.hostname = "pooled.db.prisma.io";
    }

    if (isPrismaPostgresTcp && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    if (isTcpPostgres && !url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "30");
    }

    return {
      url: url.toString(),
      host: url.hostname,
      protocol: url.protocol.replace(":", ""),
      sslmode: url.searchParams.get("sslmode"),
      connectTimeout: url.searchParams.get("connect_timeout"),
      isPrismaPostgresTcp,
      usesPooledTcp: url.hostname === "pooled.db.prisma.io",
      wasRewrittenToPooled: shouldPreferPooledTcp,
    };
  } catch (error) {
    console.warn("[prisma] DATABASE_URL could not be parsed; using raw value without runtime normalization.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      url: rawUrl,
      host: null,
      protocol: null,
      sslmode: null,
      connectTimeout: null,
      isPrismaPostgresTcp: false,
      usesPooledTcp: rawUrl.includes("pooled.db.prisma.io"),
      wasRewrittenToPooled: false,
    };
  }
}

const databaseConfig = resolveDatabaseConfig();
const prismaOptions: Prisma.PrismaClientOptions = databaseConfig
  ? {
      datasources: {
        db: {
          url: databaseConfig.url,
        },
      },
      log: prismaLogLevels,
    }
  : {
      log: prismaLogLevels,
    };

const globalForPrisma = globalThis as GlobalForPrisma;

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;

  console.info("[prisma] PrismaClient initialized.", {
    host: databaseConfig?.host ?? null,
    protocol: databaseConfig?.protocol ?? null,
    pooledTcp: databaseConfig?.usesPooledTcp ?? false,
    rewrittenToPooled: databaseConfig?.wasRewrittenToPooled ?? false,
    sslmode: databaseConfig?.sslmode ?? null,
    connectTimeout: databaseConfig?.connectTimeout ?? null,
    vercelRuntime: Boolean(process.env.VERCEL),
  });
}

export const prismaConnectionConfig = databaseConfig;

export function hasDatabaseConfig() {
  return Boolean(databaseConfig?.url ?? process.env.DATABASE_URL);
}
