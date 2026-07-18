import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUsd, formatArs } from "@/lib/money";
import { formatDate, formatDateShort, toInputDate, todayArg } from "@/lib/dates";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export { formatUsd, formatArs, formatDate, formatDateShort, formatDateShort as formatShortDate, toInputDate, todayArg };

// Legacy
export function formatCurrency(v: unknown) { return formatUsd(v as string | number | null | undefined); }
export function toCurrencyNumber(v: unknown) { if (v == null) return null; const n = typeof v === "object" && v != null && "toString" in v ? Number((v as { toString(): string }).toString()) : Number(v); return Number.isFinite(n) ? n : null; }
export function toFixedCurrencyInput(v: unknown) { const n = toCurrencyNumber(v); return n != null ? n.toFixed(2) : ""; }

export function formatIncomeStatus(value: string | null | undefined, dueDate?: string | Date | null) {
  if (value === "PAID") return "Cobrado";
  if (value === "PENDING") { if (dueDate) { const d = new Date(dueDate); const t = new Date(); if (d < t) return "Vencido"; } return "Pendiente"; }
  return "—";
}
export function formatExpenseStatus(value: string | null | undefined, dueDate?: string | Date | null) {
  if (value === "PAID") return "Pagado";
  if (value === "PENDING") { if (dueDate) { const d = new Date(dueDate); const t = new Date(); if (d < t) return "Vencido"; } return "Pendiente"; }
  return "—";
}
export function formatIncomeType(v: string | null | undefined) {
  if (v === "DEVELOPMENT") return "Desarrollo"; if (v === "MAINTENANCE") return "Mantenimiento"; if (v === "OTHER") return "Otro"; return "—";
}
export function formatProjectStatus(v: string | boolean | null | undefined) {
  if (v === true || v === "true") return "Activo"; if (v === false || v === "false") return "Inactivo"; return "—";
}
