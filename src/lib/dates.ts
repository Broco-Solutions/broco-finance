export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value + "T00:00:00") : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value + "T00:00:00") : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function toInputDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function monthLabel(m: number, y: number): string {
  return new Date(y, m - 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function todayArg(): Date {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Cordoba", year: "numeric", month: "2-digit", day: "2-digit" });
  const [yy, mm, dd] = f.format(new Date()).split("-").map(Number);
  return new Date(yy, mm - 1, dd);
}
