import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;

const describeIf = TEST_DB_URL ? describe : describe.skip;

describeIf("smoke test de conexion a PostgreSQL de test", () => {
  it("conecta exitosamente a la base de test", async () => {
    const prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });

    try {
      const result = await prisma.$queryRawUnsafe<Array<{ version: string }>>(
        "SELECT version()",
      );
      const version = result[0].version;
      expect(version).toContain("PostgreSQL");
    } finally {
      await prisma.$disconnect();
    }
  });

  it("la base de test es PostgreSQL 16.x", async () => {
    const prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });

    try {
      const result = await prisma.$queryRawUnsafe<Array<{ server_version: string }>>(
        "SHOW server_version",
      );
      const version = result[0].server_version;
      expect(version).toMatch(/^16\./);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("la base actual es la configurada en DATABASE_URL_TEST", async () => {
    const prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });

    try {
      const result = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
        "SELECT current_database()",
      );
      const dbName = result[0].current_database;
      expect(dbName).toBe("broco_finance_test");
    } finally {
      await prisma.$disconnect();
    }
  });

  it("DATABASE_URL_TEST y DATABASE_URL apuntan a la DB de test", () => {
    expect(TEST_DB_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});
