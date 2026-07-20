import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const D = Prisma.Decimal;

export const expenseSchema = z.object({
  expenseCategoryId: z.string().min(1, "Categoria requerida."),
  projectId: z.string().nullable().optional(),
  type: z.enum(["FIXED", "VARIABLE"]),
  concept: z.string().trim().min(1, "Concepto requerido."),
  notes: z.string().trim().nullable().optional(),
  status: z.enum(["PAID", "PENDING"]),
  amountUsd: z.number().nullable().optional(),
  amountArs: z.number().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

function toDec(v: number): Prisma.Decimal { return new D(v); }

function computeMoney(input: {
  amountUsd?: number | null; amountArs?: number | null; exchangeRate?: number | null;
}) {
  const ars = input.amountArs; const usd = input.amountUsd; const fx = input.exchangeRate;
  if (ars != null && ars > 0 && fx != null && fx > 0) {
    const a = toDec(ars); const f = toDec(fx);
    return { amountUsd: new D(a.dividedBy(f).toFixed(6)), amountArs: a, exchangeRate: f };
  }
  if (usd != null && usd > 0 && ars == null && fx == null) {
    return { amountUsd: toDec(Math.round(usd)), amountArs: null, exchangeRate: null };
  }
  throw new Error("Ingresa monto USD, o ARS + tipo de cambio.");
}

export async function listExpenses(filters?: { status?: string; type?: string; categoryId?: string; projectId?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.type) where.type = filters.type;
  if (filters?.categoryId) where.expenseCategoryId = filters.categoryId;
  if (filters?.projectId) where.projectId = filters.projectId;
  if (filters?.status === "PENDING" || filters?.status === "OVERDUE") where.status = "PENDING";
  else if (filters?.status === "PAID") where.status = "PAID";

  return prisma.expense.findMany({
    where,
    include: { category: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { effectiveDate: "desc" }],
  });
}

export async function getExpense(id: string) {
  const e = await prisma.expense.findUnique({ where: { id }, include: { category: true, project: true } });
  if (!e) throw new Error("Gasto no encontrado.");
  return e;
}

export async function createExpense(input: ExpenseInput) {
  const data = expenseSchema.parse(input);
  if (data.status === "PENDING" && !data.dueDate) throw new Error("La fecha de vencimiento es obligatoria.");
  if (data.status === "PAID" && !data.effectiveDate) throw new Error("La fecha de pago es obligatoria.");
  const money = computeMoney(data);
  const e = await prisma.expense.create({
    data: {
      expenseCategoryId: data.expenseCategoryId, projectId: data.projectId ?? null,
      type: data.type as "FIXED" | "VARIABLE", concept: data.concept, notes: data.notes?.trim() || null,
      status: data.status as "PAID" | "PENDING", ...money,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      effectiveDate: data.status === "PAID" ? new Date(data.effectiveDate!) : null,
    },
  });
  revalidatePath("/expenses");
  return e;
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const data = expenseSchema.parse(input);
  if (data.status === "PENDING" && !data.dueDate) throw new Error("La fecha de vencimiento es obligatoria.");
  if (data.status === "PAID" && !data.effectiveDate) throw new Error("La fecha de pago es obligatoria.");
  const money = computeMoney(data);
  const e = await prisma.expense.update({
    where: { id },
    data: {
      expenseCategoryId: data.expenseCategoryId, projectId: data.projectId ?? null,
      type: data.type as "FIXED" | "VARIABLE", concept: data.concept, notes: data.notes?.trim() || null,
      status: data.status as "PAID" | "PENDING", ...money,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      effectiveDate: data.status === "PAID" ? new Date(data.effectiveDate!) : null,
    },
  });
  revalidatePath("/expenses");
  return e;
}

export async function deleteExpense(id: string) {
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) throw new Error("Gasto no encontrado.");
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
}
