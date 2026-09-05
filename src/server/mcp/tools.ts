import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  MCP_DEFAULT_PAGE_SIZE,
  MCP_MAX_PAGE,
  MCP_MAX_RANGE_DAYS,
  MCP_MAX_RESULTS,
  MCP_REQUIRED_SCOPE,
} from "@/lib/mcp/config";
import {
  toClientSummaryDto,
  toFinancialSummaryDto,
  toFlowExpenseDto,
  toFlowIncomeDto,
  toProjectSummaryDto,
} from "@/server/mcp/dtos";
import { listClientsForMcp } from "@/server/services/clients";
import { getMcpFinancialSummary } from "@/server/services/dashboard";
import { listPendingExpensesForMcp } from "@/server/services/expenses";
import { listPendingIncomesForMcp } from "@/server/services/incomes";
import { listProjectsForMcp } from "@/server/services/projects";

export const MCP_TOOL_NAMES = [
  "resumen_financiero",
  "consultar_clientes",
  "consultar_proyectos",
  "flujo_fondos",
] as const;

const DAY_MS = 86_400_000;

function isRealIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1900 &&
    year <= 2100 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD")
  .refine(isRealIsoDate, "Fecha calendario inválida");

const pageFields = {
  pagina: z.number().int().min(1).max(MCP_MAX_PAGE).default(1),
  limite: z
    .number()
    .int()
    .min(1)
    .max(MCP_MAX_RESULTS)
    .default(MCP_DEFAULT_PAGE_SIZE),
};

function withValidRange<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ desde: isoDateSchema, hasta: isoDateSchema, ...shape })
    .strict()
    .superRefine((value, context) => {
      const range = value as { desde: string; hasta: string };
      const from = Date.parse(`${range.desde}T00:00:00Z`);
      const to = Date.parse(`${range.hasta}T00:00:00Z`);
      if (from > to) {
        context.addIssue({
          code: "custom",
          path: ["hasta"],
          message: "La fecha hasta no puede ser anterior a desde",
        });
      } else if ((to - from) / DAY_MS + 1 > MCP_MAX_RANGE_DAYS) {
        context.addIssue({
          code: "custom",
          path: ["hasta"],
          message: `El rango máximo es de ${MCP_MAX_RANGE_DAYS} días`,
        });
      }
    });
}

export const financialSummaryInputSchema = withValidRange({});
export const clientsInputSchema = z
  .object({
    texto: z.string().trim().min(1).max(100).optional(),
    ...pageFields,
  })
  .strict();
export const projectsInputSchema = z
  .object({
    texto: z.string().trim().min(1).max(100).optional(),
    clientId: z.string().uuid().optional(),
    activo: z.boolean().optional(),
    ...pageFields,
  })
  .strict();
export const cashFlowInputSchema = withValidRange(pageFields);

const amountGroupSchema = z
  .object({ cantidad: z.number().int().nonnegative(), totalUsd: z.number() })
  .strict();
const financialSummaryOutputSchema = z
  .object({
    ingresosCobrados: amountGroupSchema,
    gastosPagados: amountGroupSchema,
    netoCobradoUsd: z.number(),
    ingresosPendientes: amountGroupSchema,
    gastosPendientes: amountGroupSchema,
    ingresosVencidos: amountGroupSchema,
    gastosVencidos: amountGroupSchema,
  })
  .strict();
const pageMetadataSchema = {
  pagina: z.number().int().positive(),
  limite: z.number().int().positive(),
  hayMas: z.boolean(),
};
const clientSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    cantidadProyectos: z.number().int().nonnegative(),
  })
  .strict();
const clientsOutputSchema = z
  .object({ ...pageMetadataSchema, clientes: z.array(clientSchema) })
  .strict();
const projectSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    cliente: z.object({ id: z.string(), nombre: z.string() }).strict(),
    activo: z.boolean(),
    inicio: z.string().nullable(),
    fin: z.string().nullable(),
    importeUnicoUsd: z.number().nullable(),
    importeMensualUsd: z.number().nullable(),
    cantidadIngresos: z.number().int().nonnegative(),
    cantidadGastos: z.number().int().nonnegative(),
  })
  .strict();
const projectsOutputSchema = z
  .object({ ...pageMetadataSchema, proyectos: z.array(projectSchema) })
  .strict();
const flowIncomeSchema = z
  .object({
    id: z.string(),
    concepto: z.string(),
    vencimiento: z.string().nullable(),
    montoUsd: z.number(),
    cliente: z.string().nullable(),
    proyecto: z.string().nullable(),
  })
  .strict();
const flowExpenseSchema = z
  .object({
    id: z.string(),
    concepto: z.string(),
    vencimiento: z.string().nullable(),
    montoUsd: z.number(),
    categoria: z.string(),
    proyecto: z.string().nullable(),
  })
  .strict();
const flowSideSchema = <T extends z.ZodType>(item: T) =>
  z.object({ hayMas: z.boolean(), items: z.array(item) }).strict();
const cashFlowOutputSchema = z
  .object({
    pagina: z.number().int().positive(),
    limite: z.number().int().positive(),
    ingresos: flowSideSchema(flowIncomeSchema),
    gastos: flowSideSchema(flowExpenseSchema),
  })
  .strict();

export type McpReadServices = {
  financialSummary: typeof getMcpFinancialSummary;
  clients: typeof listClientsForMcp;
  projects: typeof listProjectsForMcp;
  incomes: typeof listPendingIncomesForMcp;
  expenses: typeof listPendingExpensesForMcp;
};

const defaultServices: McpReadServices = {
  financialSummary: getMcpFinancialSummary,
  clients: listClientsForMcp,
  projects: listProjectsForMcp,
  incomes: listPendingIncomesForMcp,
  expenses: listPendingExpensesForMcp,
};

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function paging(pagina: number, limite: number) {
  return { skip: (pagina - 1) * limite, take: limite + 1 };
}

export async function getFinancialSummary(
  rawInput: unknown,
  services: McpReadServices = defaultServices,
) {
  const input = financialSummaryInputSchema.parse(rawInput);
  const data = await services.financialSummary(
    utcDate(input.desde),
    utcDate(input.hasta),
  );
  return toFinancialSummaryDto(data);
}

export async function getClients(
  rawInput: unknown,
  services: McpReadServices = defaultServices,
) {
  const input = clientsInputSchema.parse(rawInput);
  const rows = await services.clients({
    search: input.texto,
    ...paging(input.pagina, input.limite),
  });
  return {
    pagina: input.pagina,
    limite: input.limite,
    hayMas: rows.length > input.limite,
    clientes: rows.slice(0, input.limite).map(toClientSummaryDto),
  };
}

export async function getProjects(
  rawInput: unknown,
  services: McpReadServices = defaultServices,
) {
  const input = projectsInputSchema.parse(rawInput);
  const rows = await services.projects({
    search: input.texto,
    clientId: input.clientId,
    isActive: input.activo,
    ...paging(input.pagina, input.limite),
  });
  return {
    pagina: input.pagina,
    limite: input.limite,
    hayMas: rows.length > input.limite,
    proyectos: rows.slice(0, input.limite).map(toProjectSummaryDto),
  };
}

export async function getCashFlow(
  rawInput: unknown,
  services: McpReadServices = defaultServices,
) {
  const input = cashFlowInputSchema.parse(rawInput);
  const range = {
    from: utcDate(input.desde),
    to: utcDate(input.hasta),
    ...paging(input.pagina, input.limite),
  };
  const [incomes, expenses] = await Promise.all([
    services.incomes(range),
    services.expenses(range),
  ]);
  return {
    pagina: input.pagina,
    limite: input.limite,
    ingresos: {
      hayMas: incomes.length > input.limite,
      items: incomes.slice(0, input.limite).map(toFlowIncomeDto),
    },
    gastos: {
      hayMas: expenses.length > input.limite,
      items: expenses.slice(0, input.limite).map(toFlowExpenseDto),
    },
  };
}

const toolMetadata = {
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: {
    securitySchemes: [{ type: "oauth2", scopes: [MCP_REQUIRED_SCOPE] }],
  },
};

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

export function registerTools(
  server: McpServer,
  services: McpReadServices = defaultServices,
) {
  server.registerTool(
    "resumen_financiero",
    {
      title: "Resumen financiero",
      description:
        "Totales agregados de ingresos, gastos y vencidos para un período de hasta 366 días.",
      inputSchema: financialSummaryInputSchema,
      outputSchema: financialSummaryOutputSchema,
      ...toolMetadata,
    },
    async (input) => result(await getFinancialSummary(input, services)),
  );

  server.registerTool(
    "consultar_clientes",
    {
      title: "Consultar clientes",
      description:
        "Lista paginada de clientes por nombre; no devuelve contactos ni notas internas.",
      inputSchema: clientsInputSchema,
      outputSchema: clientsOutputSchema,
      ...toolMetadata,
    },
    async (input) => result(await getClients(input, services)),
  );

  server.registerTool(
    "consultar_proyectos",
    {
      title: "Consultar proyectos",
      description:
        "Lista paginada de proyectos por nombre, cliente o estado, sin notas ni enlaces privados.",
      inputSchema: projectsInputSchema,
      outputSchema: projectsOutputSchema,
      ...toolMetadata,
    },
    async (input) => result(await getProjects(input, services)),
  );

  server.registerTool(
    "flujo_fondos",
    {
      title: "Flujo de fondos",
      description:
        "Ingresos y gastos pendientes, paginados y acotados a un rango máximo de 366 días.",
      inputSchema: cashFlowInputSchema,
      outputSchema: cashFlowOutputSchema,
      ...toolMetadata,
    },
    async (input) => result(await getCashFlow(input, services)),
  );
}
