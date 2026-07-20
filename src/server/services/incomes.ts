import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const D = Prisma.Decimal;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const incomeSchema = z.object({
  projectId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  type: z.enum(["DEVELOPMENT", "MAINTENANCE", "OTHER"]),
  concept: z.string().trim().min(1, "El concepto es obligatorio."),
  notes: z.string().trim().nullable().optional(),
  status: z.enum(["PAID", "PENDING"]),
  amountUsd: z.number().nullable().optional(),
  amountArs: z.number().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
});

export type IncomeInput = z.infer<typeof incomeSchema>;


// ---------------------------------------------------------------------------
// Decimal helpers
// ---------------------------------------------------------------------------

function toDec(v: number): Prisma.Decimal { return new D(v); }

function computeMoney(input: {
  amountUsd?: number | null;
  amountArs?: number | null;
  exchangeRate?: number | null;
}): { amountUsd: Prisma.Decimal; amountArs: Prisma.Decimal | null; exchangeRate: Prisma.Decimal | null } {
  const usd = input.amountUsd;
  const ars = input.amountArs;
  const fx = input.exchangeRate;

  // ARS + rate → compute USD
  if (ars != null && ars > 0 && fx != null && fx > 0) {
    const arsDec = toDec(ars);
    const fxDec = toDec(fx);
    const usdDec = new D(arsDec.dividedBy(fxDec).toFixed(6));
    return { amountUsd: usdDec, amountArs: arsDec, exchangeRate: fxDec };
  }

  // USD only
  if (usd != null && usd > 0 && ars == null && fx == null) {
    return { amountUsd: toDec(Math.round(usd)), amountArs: null, exchangeRate: null };
  }

  throw new Error("Ingresa monto USD, o ARS + tipo de cambio.");
}


// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listIncomes(filters?: {
  status?: string;
  type?: string;
  clientId?: string;
  projectId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.type) where.type = filters.type;
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.projectId) where.projectId = filters.projectId;

  if (filters?.status === "PENDING" || filters?.status === "OVERDUE") {
    where.status = "PENDING";
  } else if (filters?.status === "PAID") {
    where.status = "PAID";
  }

  return prisma.income.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { effectiveDate: "desc" }],
  });
}

export async function getIncome(id: string) {
  const income = await prisma.income.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, clientId: true } },
    },
  });
  if (!income) throw new Error("Ingreso no encontrado.");
  return income;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createIncome(input: IncomeInput) {
  const data = incomeSchema.parse(input);

  // Resolve client from project for DEVELOPMENT/MAINTENANCE
  let clientId = data.clientId ?? null;
  if (data.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { clientId: true },
    });
    if (!project) throw new Error("Proyecto no encontrado.");
    clientId = project.clientId;
  }

  // Validate: DEVELOPMENT/MAINTENANCE require project
  if ((data.type === "DEVELOPMENT" || data.type === "MAINTENANCE") && !data.projectId) {
    throw new Error("DEVELOPMENT y MAINTENANCE requieren proyecto.");
  }

  // Validate status + dates
  if (data.status === "PENDING" && !data.dueDate) {
    throw new Error("La fecha de vencimiento es obligatoria para ingresos pendientes.");
  }
  if (data.status === "PAID" && !data.effectiveDate) {
    throw new Error("La fecha de cobro es obligatoria para ingresos pagados.");
  }

  const money = computeMoney(data);

  const income = await prisma.income.create({
    data: {
      clientId,
      projectId: data.projectId ?? null,
      type: data.type as "DEVELOPMENT" | "MAINTENANCE" | "OTHER",
      concept: data.concept,
      notes: data.notes?.trim() || null,
      status: data.status as "PAID" | "PENDING",
      ...money,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      effectiveDate: data.status === "PAID" ? new Date(data.effectiveDate!) : null,
    },
  });
  revalidatePath("/incomes");
  return income;
}

export async function updateIncome(id: string, input: IncomeInput) {
  const data = incomeSchema.parse(input);

  let clientId = data.clientId ?? null;
  if (data.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { clientId: true },
    });
    if (!project) throw new Error("Proyecto no encontrado.");
    clientId = project.clientId;
  }

  if ((data.type === "DEVELOPMENT" || data.type === "MAINTENANCE") && !data.projectId) {
    throw new Error("DEVELOPMENT y MAINTENANCE requieren proyecto.");
  }

  if (data.status === "PENDING" && !data.dueDate) {
    throw new Error("La fecha de vencimiento es obligatoria para ingresos pendientes.");
  }
  if (data.status === "PAID" && !data.effectiveDate) {
    throw new Error("La fecha de cobro es obligatoria para ingresos pagados.");
  }

  const money = computeMoney(data);

  const income = await prisma.income.update({
    where: { id },
    data: {
      clientId,
      projectId: data.projectId ?? null,
      type: data.type as "DEVELOPMENT" | "MAINTENANCE" | "OTHER",
      concept: data.concept,
      notes: data.notes?.trim() || null,
      status: data.status as "PAID" | "PENDING",
      ...money,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      effectiveDate: data.status === "PAID" ? new Date(data.effectiveDate!) : null,
    },
  });
  revalidatePath("/incomes");
  return income;
}

export async function deleteIncome(id: string) {
  const existing = await prisma.income.findUnique({ where: { id } });
  if (!existing) throw new Error("Ingreso no encontrado.");
  await prisma.income.delete({ where: { id } });
  revalidatePath("/incomes");
}

export type BatchEntry = {
  type: string; projectId?: string | null; clientId?: string | null;
  concept: string; notes?: string | null; status: string;
  amountUsd?: number | null; amountArs?: number | null; exchangeRate?: number | null;
  dueDate?: string | null; effectiveDate?: string | null;
};

export async function createIncomeBatch(entries: BatchEntry[]) {
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const data = incomeSchema.parse(entry);
      if (data.status === "PENDING" && !data.dueDate) throw new Error("La fecha de vencimiento es obligatoria.");
      if (data.status === "PAID" && !data.effectiveDate) throw new Error("La fecha de cobro es obligatoria.");
      const money = computeMoney(data);
      await tx.income.create({
        data: {
          clientId: data.projectId ? (await tx.project.findUnique({ where: { id: data.projectId }, select: { clientId: true } }))?.clientId ?? data.clientId ?? null : data.clientId ?? null,
          projectId: data.projectId ?? null,
          type: data.type as "DEVELOPMENT" | "MAINTENANCE" | "OTHER",
          concept: data.concept,
          notes: data.notes?.trim() || null,
          status: data.status as "PAID" | "PENDING",
          ...money,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          effectiveDate: data.status === "PAID" ? new Date(data.effectiveDate!) : null,
        },
      });
    }
  });
  revalidatePath("/incomes");
}

