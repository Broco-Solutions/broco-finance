import { clsx, type ClassValue } from "clsx";
import { format, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

type NumericLike =
  | number
  | string
  | {
      toNumber?: () => number;
      toString(): string;
    }
  | null
  | undefined;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toCurrencyNumber(value: NumericLike) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().replace(/\s+/g, "");
    const normalized = trimmed.includes(".") && trimmed.includes(",") ? trimmed.replaceAll(",", "") : trimmed.replace(",", ".");
    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    const numericValue = value.toNumber();
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  const numericValue = Number(value.toString());
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function formatCurrency(value: NumericLike) {
  const numericValue = toCurrencyNumber(value);

  if (numericValue === null) {
    return "—";
  }

  return usdFormatter.format(roundCurrency(numericValue));
}

export function formatUsd(value: NumericLike) {
  return formatCurrency(value);
}

export function formatIncomeStatus(value: string | null | undefined) {
  if (value === "PAID") {
    return "Cobrado";
  }

  if (value === "PENDING") {
    return "Pendiente";
  }

  return "—";
}

export function formatIncomeType(value: string | null | undefined) {
  if (value === "DEVELOPMENT") {
    return "Desarrollo";
  }

  if (value === "MAINTENANCE") {
    return "Mantenimiento";
  }

  return "—";
}

export function formatProjectStatus(value: string | null | undefined) {
  if (value === "ACTIVE") {
    return "Activo";
  }

  if (value === "COMPLETED") {
    return "Completado";
  }

  if (value === "CANCELLED") {
    return "Cancelado";
  }

  return "—";
}

export function toFixedCurrencyInput(value: NumericLike) {
  const numericValue = toCurrencyNumber(value);
  return numericValue === null ? "" : roundCurrency(numericValue).toFixed(2);
}

export function formatArs(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatShortDate(value: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, "dd MMM yyyy");
}

export function formatMonthLabel(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, "MMM yyyy");
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
