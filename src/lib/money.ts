const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("es-AR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });

export function formatUsd(value: number | string | { toString(): string } | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "object" && "toString" in value ? Number(value.toString()) : Number(value);
  if (!Number.isFinite(n)) return "—";
  return usd.format(n);
}

export function formatArs(value: number | string | { toString(): string } | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "object" && "toString" in value ? Number(value.toString()) : Number(value);
  if (!Number.isFinite(n)) return "—";
  return ars.format(n);
}

export function formatPct(current: number, previous: number): string {
  if (previous === 0) return "—";
  return pct.format((current - previous) / Math.abs(previous));
}

export function formatChange(current: number, previous: number): { text: string; positive: boolean } | null {
  if (previous === 0) return null;
  const change = (current - previous) / Math.abs(previous);
  if (!Number.isFinite(change)) return null;
  return { text: pct.format(change), positive: change >= 0 };
}
