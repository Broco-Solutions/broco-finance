import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const D = Prisma.Decimal;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const currencySchema = z.enum(["USD", "ARS"]);

const oneTimeSchema = z
  .object({
    oneTimeOriginalAmount: z.number().nullable().optional(),
    oneTimeCurrency: currencySchema.nullable().optional(),
    oneTimeExchangeRate: z.number().nullable().optional(),
  })
  .optional();

const monthlySchema = z
  .object({
    monthlyRecurringOriginalAmount: z.number().nullable().optional(),
    monthlyRecurringCurrency: currencySchema.nullable().optional(),
    monthlyRecurringExchangeRate: z.number().nullable().optional(),
  })
  .optional();

export const projectInputSchema = z.object({
  clientId: z.string().min(1, "El cliente es obligatorio."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  isActive: z.boolean().default(true),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  oneTimeOriginalAmount: z.number().nullable().optional(),
  oneTimeCurrency: currencySchema.nullable().optional(),
  oneTimeExchangeRate: z.number().nullable().optional(),
  monthlyRecurringOriginalAmount: z.number().nullable().optional(),
  monthlyRecurringCurrency: currencySchema.nullable().optional(),
  monthlyRecurringExchangeRate: z.number().nullable().optional(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

// ---------------------------------------------------------------------------
// Decimal helpers
// ---------------------------------------------------------------------------

function toDec(v: number): Prisma.Decimal {
  return new D(v);
}

function computeOneTimeAmounts(input: {
  oneTimeOriginalAmount?: number | null;
  oneTimeCurrency?: "USD" | "ARS" | null;
  oneTimeExchangeRate?: number | null;
}) {
  const amt = input.oneTimeOriginalAmount;
  if (amt == null) {
    return {
      oneTimeOriginalAmount: null,
      oneTimeCurrency: null,
      oneTimeExchangeRate: null,
      oneTimeAmountUsd: null,
    };
  }

  if (amt <= 0) throw new Error("El importe acordado debe ser mayor que cero.");

  if (input.oneTimeCurrency === "USD") {
    if (input.oneTimeExchangeRate != null) {
      throw new Error("Un proyecto en USD no debe tener tipo de cambio.");
    }
    const usd = toDec(amt);
    return {
      oneTimeOriginalAmount: usd,
      oneTimeCurrency: "USD" as const,
      oneTimeExchangeRate: null,
      oneTimeAmountUsd: usd,
    };
  }

  if (input.oneTimeCurrency === "ARS") {
    if (!input.oneTimeExchangeRate || input.oneTimeExchangeRate <= 0) {
      throw new Error("Un proyecto en ARS requiere tipo de cambio mayor que cero.");
    }
    const rate = toDec(input.oneTimeExchangeRate);
    const usd = toDec(amt).dividedBy(rate).toFixed(6);
    return {
      oneTimeOriginalAmount: toDec(amt),
      oneTimeCurrency: "ARS" as const,
      oneTimeExchangeRate: rate,
      oneTimeAmountUsd: new D(usd),
    };
  }

  throw new Error("Moneda invalida. Usa USD o ARS.");
}

function computeMonthlyAmounts(input: {
  monthlyRecurringOriginalAmount?: number | null;
  monthlyRecurringCurrency?: "USD" | "ARS" | null;
  monthlyRecurringExchangeRate?: number | null;
}) {
  const amt = input.monthlyRecurringOriginalAmount;
  if (amt == null) {
    return {
      monthlyRecurringOriginalAmount: null,
      monthlyRecurringCurrency: null,
      monthlyRecurringExchangeRate: null,
      monthlyRecurringAmountUsd: null,
    };
  }

  if (amt <= 0) throw new Error("El importe mensual debe ser mayor que cero.");

  if (input.monthlyRecurringCurrency === "USD") {
    if (input.monthlyRecurringExchangeRate != null) {
      throw new Error("Un proyecto en USD no debe tener tipo de cambio.");
    }
    const usd = toDec(amt);
    return {
      monthlyRecurringOriginalAmount: usd,
      monthlyRecurringCurrency: "USD" as const,
      monthlyRecurringExchangeRate: null,
      monthlyRecurringAmountUsd: usd,
    };
  }

  if (input.monthlyRecurringCurrency === "ARS") {
    if (!input.monthlyRecurringExchangeRate || input.monthlyRecurringExchangeRate <= 0) {
      throw new Error("Un proyecto en ARS requiere tipo de cambio mayor que cero.");
    }
    const rate = toDec(input.monthlyRecurringExchangeRate);
    const usd = toDec(amt).dividedBy(rate).toFixed(6);
    return {
      monthlyRecurringOriginalAmount: toDec(amt),
      monthlyRecurringCurrency: "ARS" as const,
      monthlyRecurringExchangeRate: rate,
      monthlyRecurringAmountUsd: new D(usd),
    };
  }

  throw new Error("Moneda invalida. Usa USD o ARS.");
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listProjects(filters?: {
  clientId?: string;
  isActive?: boolean;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  return prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      clientId: true,
      isActive: true,
      startDate: true,
      endDate: true,
      oneTimeOriginalAmount: true,
      oneTimeCurrency: true,
      oneTimeAmountUsd: true,
      monthlyRecurringOriginalAmount: true,
      monthlyRecurringCurrency: true,
      monthlyRecurringAmountUsd: true,
      client: { select: { id: true, name: true } },
      _count: { select: { incomes: true, expenses: true } },
    },
    orderBy: [{ isActive: "desc" }, { client: { name: "asc" } }, { name: "asc" }],
  });
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      _count: { select: { incomes: true, expenses: true } },
    },
  });
  if (!project) throw new Error("Proyecto no encontrado.");

  const [incAll, incPaid, incPending, expAll, expPaid, expPending] = await Promise.all([
    prisma.income.aggregate({ where: { projectId: id }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.income.aggregate({ where: { projectId: id, status: "PAID" }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.income.aggregate({ where: { projectId: id, status: "PENDING" }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.expense.aggregate({ where: { projectId: id }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.expense.aggregate({ where: { projectId: id, status: "PAID" }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.expense.aggregate({ where: { projectId: id, status: "PENDING" }, _sum: { amountUsd: true, amountArs: true } }),
  ]);

  return {
    ...project,
    _incomeTotals: {
      all: incAll._sum.amountUsd ?? 0,
      paid: incPaid._sum.amountUsd ?? 0,
      pending: incPending._sum.amountUsd ?? 0,
      allArs: incAll._sum.amountArs ?? 0,
      paidArs: incPaid._sum.amountArs ?? 0,
      pendingArs: incPending._sum.amountArs ?? 0,
    },
    _expenseTotals: {
      all: expAll._sum.amountUsd ?? 0,
      paid: expPaid._sum.amountUsd ?? 0,
      pending: expPending._sum.amountUsd ?? 0,
      allArs: expAll._sum.amountArs ?? 0,
      paidArs: expPaid._sum.amountArs ?? 0,
      pendingArs: expPending._sum.amountArs ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProject(input: ProjectInput) {
  const data = projectInputSchema.parse(input);
  const oneTime = computeOneTimeAmounts(data);
  const monthly = computeMonthlyAmounts(data);

  // Validate startDate <= endDate
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
  }

  try {
    const project = await prisma.project.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        isActive: data.isActive,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes?.trim() || null,
        ...oneTime,
        ...monthly,
      },
    });
    revalidatePath("/projects");
    return project;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new Error(
        "Ya existe un proyecto con ese nombre para este cliente.",
      );
    }
    throw error;
  }
}

export async function updateProject(id: string, input: ProjectInput) {
  const data = projectInputSchema.parse(input);
  const existing = await prisma.project.findUnique({
    where: { id },
    select: { clientId: true, _count: { select: { incomes: true, expenses: true } } },
  });
  if (!existing) throw new Error("Proyecto no encontrado.");

  // Block client change if project has movements
  if (data.clientId !== existing.clientId) {
    const hasMovements =
      existing._count.incomes > 0 || existing._count.expenses > 0;
    if (hasMovements) {
      throw new Error(
        "No se puede cambiar el cliente porque el proyecto tiene movimientos asociados.",
      );
    }
  }

  const oneTime = computeOneTimeAmounts(data);
  const monthly = computeMonthlyAmounts(data);

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        clientId: data.clientId,
        name: data.name,
        isActive: data.isActive,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes?.trim() || null,
        ...oneTime,
        ...monthly,
      },
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return project;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new Error(
        "Ya existe un proyecto con ese nombre para este cliente.",
      );
    }
    throw error;
  }
}

export async function deleteProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      _count: { select: { incomes: true, expenses: true } },
    },
  });
  if (!project) throw new Error("Proyecto no encontrado.");

  if (project._count.incomes > 0 || project._count.expenses > 0) {
    throw new Error(
      "No se puede eliminar el proyecto porque tiene movimientos asociados.",
    );
  }

  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
}
