"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  createIncome,
  updateIncome,
  deleteIncome,
  generateInstallments,
  incomeSchema,
  installmentSchema,
} from "@/server/services/incomes";

type ActionResult = { success: true } | { success: false; message: string };

async function requireAuth() {
  if (!isAuthenticated()) throw new Error("Sesion expirada.");
}

function parseNum(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function saveIncome(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    requireAuth();
    const data = incomeSchema.parse({
      projectId: formData.get("projectId") || null,
      clientId: formData.get("clientId") || null,
      type: formData.get("type"),
      concept: formData.get("concept"),
      notes: formData.get("notes") || null,
      status: formData.get("status"),
      amountUsd: parseNum(formData.get("amountUsd")),
      amountArs: parseNum(formData.get("amountArs")),
      exchangeRate: parseNum(formData.get("exchangeRate")),
      dueDate: formData.get("dueDate") || null,
      effectiveDate: formData.get("effectiveDate") || null,
    });

    const id = formData.get("id") as string | null;
    if (id) {
      await updateIncome(id, data);
    } else {
      await createIncome(data);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al guardar." };
  }
}

export async function removeIncome(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    requireAuth();
    await deleteIncome(formData.get("id") as string);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al eliminar." };
  }
}

export async function payIncome(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    requireAuth();
    const id = formData.get("id") as string;
    const income = await import("@/server/services/incomes").then((m) => m.getIncome(id));

    const data = incomeSchema.parse({
      projectId: income.projectId,
      clientId: income.clientId,
      type: income.type,
      concept: income.concept,
      notes: income.notes,
      status: "PAID",
      amountUsd: parseNum(formData.get("amountUsd")) ?? Number(income.amountUsd),
      amountArs: parseNum(formData.get("amountArs")) ?? (income.amountArs ? Number(income.amountArs) : undefined),
      exchangeRate: parseNum(formData.get("exchangeRate")) ?? (income.exchangeRate ? Number(income.exchangeRate) : undefined),
      dueDate: income.dueDate?.toISOString().slice(0, 10) ?? null,
      effectiveDate: formData.get("effectiveDate") as string,
    });

    await updateIncome(id, data);
    revalidatePath("/incomes");
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al cobrar." };
  }
}

export async function createInstallments(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    requireAuth();
    const data = installmentSchema.parse({
      projectId: formData.get("projectId"),
      type: formData.get("type"),
      concept: formData.get("concept"),
      count: Number(formData.get("count")),
      firstDueDate: formData.get("firstDueDate"),
      amountUsd: parseNum(formData.get("amountUsd")),
      amountArs: parseNum(formData.get("amountArs")),
      exchangeRate: parseNum(formData.get("exchangeRate")),
      notes: formData.get("notes") || null,
    });
    const result = await generateInstallments(data);
    revalidatePath("/incomes");
    return { success: true, message: `${result.count} cuotas creadas.` } as ActionResult & { message?: string };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al generar cuotas." };
  }
}
