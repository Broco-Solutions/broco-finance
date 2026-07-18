import { todayArg } from "@/lib/dates";

export type Period = { from: Date; to: Date; label: string; prevFrom: Date; prevTo: Date };
export type PeriodPreset = "this-month" | "last-month" | "this-year" | "custom";

function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) + 1; }

export function resolvePeriod(preset: string | null, fromStr: string | null, toStr: string | null): Period {
  const today = todayArg();
  const y = today.getFullYear(), m = today.getMonth();

  if (preset === "last-month") {
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    const from = new Date(prevY, prevM, 1);
    const to = new Date(prevY, prevM + 1, 0);
    const prevFrom = new Date(prevY, prevM - 1, 1);
    const prevTo = new Date(prevY, prevM, 0);
    return { from, to, label: toLocaleMonth(prevY, prevM), prevFrom, prevTo };
  }

  if (preset === "this-year") {
    const from = new Date(y, 0, 1);
    const to = today;
    const days = daysBetween(from, to);
    const prevTo = new Date(y - 1, 0, days);
    const prevFrom = new Date(y - 1, 0, 1);
    return { from, to, label: `Ene – ${today.toLocaleDateString("es-AR", { month: "short" })} ${y}`, prevFrom, prevTo };
  }

  if (preset === "custom" && fromStr && toStr) {
    const from = new Date(fromStr + "T00:00:00");
    const to = new Date(toStr + "T00:00:00");
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return resolvePeriod("this-month", null, null);
    }
    const days = daysBetween(from, to);
    const prevTo = new Date(from.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
    return { from, to, label: `${fromStr} – ${toStr}`, prevFrom, prevTo };
  }

  // Default: this-month
  const from = new Date(y, m, 1);
  const to = today;
  const days = daysBetween(from, to);
  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  const prevMonthDays = new Date(prevY, prevM + 1, 0).getDate();
  const clampedDays = Math.min(days, prevMonthDays);
  const prevTo = new Date(prevY, prevM, clampedDays);
  const prevFrom = new Date(prevY, prevM, 1);
  return { from, to, label: `${toLocaleMonth(y, m)} (al ${today.getDate()})`, prevFrom, prevTo };
}

function toLocaleMonth(y: number, m: number) {
  return new Date(y, m).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}
