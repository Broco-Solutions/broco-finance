import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertReadOnlyTestDatabase } from "@/lib/test-db-guard";
import { prisma } from "@/server/prisma";
import { getClients, getFinancialSummary } from "@/server/mcp/tools";

const hasTestDatabase = Boolean(
  process.env.DATABASE_URL && process.env.DATABASE_URL_TEST,
);

describe.skipIf(!hasTestDatabase)("MCP solo lectura contra PostgreSQL de test", () => {
  let beforeCounts: number[] | undefined;

  beforeAll(async () => {
    assertReadOnlyTestDatabase();
    beforeCounts = await Promise.all([
      prisma.client.count(),
      prisma.project.count(),
      prisma.income.count(),
      prisma.expense.count(),
    ]);
  });

  afterAll(async () => {
    if (!beforeCounts) {
      await prisma.$disconnect();
      return;
    }
    const afterCounts = await Promise.all([
      prisma.client.count(),
      prisma.project.count(),
      prisma.income.count(),
      prisma.expense.count(),
    ]);
    expect(afterCounts).toEqual(beforeCounts);
    await prisma.$disconnect();
  });

  it("consulta clientes con límite acotado y DTO mínimo", async () => {
    const result = await getClients({ pagina: 1, limite: 2 });
    expect(result.clientes.length).toBeLessThanOrEqual(2);
    for (const client of result.clientes) {
      expect(Object.keys(client).sort()).toEqual([
        "cantidadProyectos",
        "id",
        "nombre",
      ]);
    }
  });

  it("calcula solo agregados financieros dentro del rango", async () => {
    const result = await getFinancialSummary({
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });
    expect(Object.keys(result).sort()).toEqual([
      "gastosPagados",
      "gastosPendientes",
      "gastosVencidos",
      "ingresosCobrados",
      "ingresosPendientes",
      "ingresosVencidos",
      "netoCobradoUsd",
    ]);
  });
});
