import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  cashFlowInputSchema,
  getCashFlow,
  getClients,
  getProjects,
  MCP_TOOL_NAMES,
  registerTools,
  type McpReadServices,
} from "@/server/mcp/tools";

function services(): McpReadServices {
  return {
    financialSummary: vi.fn(),
    clients: vi.fn().mockResolvedValue([]),
    projects: vi.fn().mockResolvedValue([]),
    incomes: vi.fn().mockResolvedValue([]),
    expenses: vi.fn().mockResolvedValue([]),
  } as unknown as McpReadServices;
}

describe("límites y DTOs MCP", () => {
  it.each(["2026-02-30", "2026-13-01", "2026-2-01"])(
    "rechaza fecha no real: %s",
    (desde) => {
      expect(() =>
        cashFlowInputSchema.parse({ desde, hasta: "2026-03-01" }),
      ).toThrow();
    },
  );

  it("rechaza rango invertido, demasiado largo, claves extra y límite excesivo", () => {
    expect(() =>
      cashFlowInputSchema.parse({ desde: "2026-03-02", hasta: "2026-03-01" }),
    ).toThrow();
    expect(() =>
      cashFlowInputSchema.parse({ desde: "2025-01-01", hasta: "2026-02-01" }),
    ).toThrow();
    expect(() =>
      cashFlowInputSchema.parse({
        desde: "2026-01-01",
        hasta: "2026-01-02",
        limite: 51,
      }),
    ).toThrow();
    expect(() =>
      cashFlowInputSchema.parse({
        desde: "2026-01-01",
        hasta: "2026-01-02",
        sql: "select *",
      }),
    ).toThrow();
  });

  it("pagina en DB con limit+1 y devuelve solo el DTO permitido de cliente", async () => {
    const mock = services();
    vi.mocked(mock.clients).mockResolvedValueOnce([
      { id: "c1", name: "Cliente", _count: { projects: 2 } },
      { id: "c2", name: "Extra", _count: { projects: 0 } },
    ]);
    const result = await getClients({ pagina: 2, limite: 1 }, mock);
    expect(mock.clients).toHaveBeenCalledWith({
      search: undefined,
      skip: 1,
      take: 2,
    });
    expect(result).toEqual({
      pagina: 2,
      limite: 1,
      hayMas: true,
      clientes: [{ id: "c1", nombre: "Cliente", cantidadProyectos: 2 }],
    });
    expect(JSON.stringify(result)).not.toMatch(/email|phone|notes|password|token/i);
  });

  it("proyecto y flujo eliminan campos no incluidos en sus DTOs", async () => {
    const mock = services();
    vi.mocked(mock.projects).mockResolvedValueOnce([
      {
        id: "p1",
        name: "Proyecto",
        isActive: true,
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: null,
        oneTimeAmountUsd: new Prisma.Decimal(100),
        monthlyRecurringAmountUsd: null,
        client: { id: "c1", name: "Cliente" },
        _count: { incomes: 1, expenses: 2 },
      },
    ]);
    const projects = await getProjects({}, mock);
    expect(projects.proyectos[0]).toEqual({
      id: "p1",
      nombre: "Proyecto",
      cliente: { id: "c1", nombre: "Cliente" },
      activo: true,
      inicio: "2026-01-01",
      fin: null,
      importeUnicoUsd: 100,
      importeMensualUsd: null,
      cantidadIngresos: 1,
      cantidadGastos: 2,
    });

    vi.mocked(mock.incomes).mockResolvedValueOnce([
      {
        id: "i1",
        concept: "Cobro",
        dueDate: new Date("2026-01-02T00:00:00Z"),
        amountUsd: new Prisma.Decimal(20),
        client: { name: "Cliente" },
        project: null,
      },
    ]);
    const flow = await getCashFlow(
      { desde: "2026-01-01", hasta: "2026-01-31" },
      mock,
    );
    expect(flow.ingresos.items[0]).toEqual({
      id: "i1",
      concepto: "Cobro",
      vencimiento: "2026-01-02",
      montoUsd: 20,
      cliente: "Cliente",
      proyecto: null,
    });
  });
});

describe("superficie MCP solo lectura", () => {
  it("registra exactamente cuatro tools marcadas como no destructivas", () => {
    const registered: Array<{ name: string; definition: Record<string, unknown> }> = [];
    const server = {
      registerTool(name: string, definition: Record<string, unknown>) {
        registered.push({ name, definition });
      },
    } as unknown as McpServer;
    registerTools(server, services());
    expect(registered.map(({ name }) => name)).toEqual(MCP_TOOL_NAMES);
    for (const { definition } of registered) {
      expect(definition.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(definition._meta).toEqual({
        securitySchemes: [{ type: "oauth2", scopes: ["mcp:read"] }],
      });
    }
  });

  it("los módulos MCP no contienen primitivas de mutación, SQL ni ejecución arbitraria", () => {
    const files = [
      "src/server/mcp/tools.ts",
      "src/server/mcp/dtos.ts",
      "src/server/mcp/http.ts",
    ];
    const source = files
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
    );
    expect(source).not.toMatch(/\$(?:queryRaw|executeRaw)|child_process|eval\s*\(/);
  });
});
