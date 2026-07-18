import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUsd } from "@/lib/money";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export { formatUsd, formatArs } from "@/lib/money";
export { formatDate, formatDateShort as formatShortDate, toInputDate } from "@/lib/dates";

// Legacy aliases
export function toCurrencyNumber(v: unknown) { if (v == null) return null; const n = typeof v === "object" && v != null && "toString" in v ? Number((v as { toString(): string }).toString()) : Number(v); return Number.isFinite(n) ? n : null; }
export function formatCurrency(v: unknown) { return formatUsd(v as string | number | null | undefined); }
export function toFixedCurrencyInput(v: unknown) { const n = toCurrencyNumber(v); return n != null ? n.toFixed(2) : ""; }

export function formatIncomeStatus(value: string | null | undefined, dueDate?: string | Date | null) {
  if (value === "PAID") return "Cobrado";
  if (value === "PENDING") {
    if (dueDate) { const d = new Date(dueDate); const t = new Date(); if (d < t) return "Vencido"; }
    return "Pendiente";
  }
  return "—";
}

export function formatExpenseStatus(value: string | null | undefined, dueDate?: string | Date | null) {
  if (value === "PAID") return "Pagado";
  if (value === "PENDING") {
    if (dueDate) { const d = new Date(dueDate); const t = new Date(); if (d < t) return "Vencido"; }
    return "Pendiente";
  }
  return "—";
}

export function formatIncomeType(v: string | null | undefined) {
  if (v === "DEVELOPMENT") return "Desarrollo";
  if (v === "MAINTENANCE") return "Mantenimiento";
  if (v === "OTHER") return "Otro";
  return "—";
}

export function formatProjectStatus(v: string | boolean | null | undefined) {
  if (v === true || v === "true") return "Activo";
  if (v === false || v === "false") return "Inactivo";
  return "—";
}
