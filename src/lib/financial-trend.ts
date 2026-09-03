import { toUtcDate } from "./dates";

export type MonthBucket = {
  year: number;
  month: number; // 1-12
  label: string;
  shortLabel: string;
  fromISO: string;
  toISO: string;
  incomesUsd: number;
  expensesUsd: number;
  netUsd: number;
  trendNetUsd?: number;
  prevIncomesUsd?: number;
  prevExpensesUsd?: number;
  prevNetUsd?: number;
  incomesByType?: Record<string, number>;
};

export type EvolutionRangeKey = "6m" | "12m" | "year";

export function lastClosedMonth(todayKey: string): { year: number; month: number } {
  const [y, m] = todayKey.split("-").map(Number);
  // todayKey is e.g. 2026-09-02 -> last closed is 2026-08
  let year = y;
  let month = m - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return { year, month };
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthShortLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).replace(".", "");
}

export function monthBounds(year: number, month: number): { fromISO: string; toISO: string } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return {
    fromISO: from.toISOString().slice(0, 10),
    toISO: to.toISOString().slice(0, 10),
  };
}

export function getEvolutionMonths(todayKey: string, range: EvolutionRangeKey): MonthBucket[] {
  const last = lastClosedMonth(todayKey);
  let startYear: number;
  let startMonth: number;
  let count: number;

  if (range === "6m") {
    count = 6;
    const d = new Date(Date.UTC(last.year, last.month - 1, 1));
    d.setUTCMonth(d.getUTCMonth() - 5);
    startYear = d.getUTCFullYear();
    startMonth = d.getUTCMonth() + 1;
  } else if (range === "12m") {
    count = 12;
    const d = new Date(Date.UTC(last.year, last.month - 1, 1));
    d.setUTCMonth(d.getUTCMonth() - 11);
    startYear = d.getUTCFullYear();
    startMonth = d.getUTCMonth() + 1;
  } else {
    // year: Jan of current year to last closed
    const [cy] = todayKey.split("-").map(Number);
    if (last.year < cy) {
      // January case: no closed months in current year
      return [];
    }
    if (last.year > cy) {
      // Should not happen (last closed is previous year), but then year would be empty
      return [];
    }
    startYear = cy;
    startMonth = 1;
    count = last.month;
    // last.month is e.g. 8 for Aug, so Jan..Aug = 8 months
  }

  const months: MonthBucket[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < count; i++) {
    const bounds = monthBounds(y, m);
    months.push({
      year: y,
      month: m,
      label: monthLabel(y, m),
      shortLabel: monthShortLabel(y, m),
      fromISO: bounds.fromISO,
      toISO: bounds.toISO,
      incomesUsd: 0,
      expensesUsd: 0,
      netUsd: 0,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function bucketByMonth(
  months: MonthBucket[],
  incomes: Array<{ effectiveDate: Date | string | null; amountUsd: any; typeId?: string }>,
  expenses: Array<{ effectiveDate: Date | string | null; amountUsd: any }>,
  baseline?: { year: number; month: number; incomesUsd: number; expensesUsd: number; incomesByType?: Record<string, number> },
): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const m of months) {
    const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
    map.set(key, { ...m, incomesByType: {} });
  }

  for (const inc of incomes) {
    if (!inc.effectiveDate) continue;
    const raw = inc.effectiveDate as unknown;
    const iso = raw instanceof Date ? raw.toISOString().slice(0, 7) : String(raw).slice(0, 7);
    const bucket = map.get(iso);
    if (bucket) {
      bucket.incomesUsd += Number(inc.amountUsd ?? 0);
      if ((inc as any).typeId) {
        const tid = String((inc as any).typeId);
        bucket.incomesByType![tid] = (bucket.incomesByType![tid] ?? 0) + Number(inc.amountUsd ?? 0);
      }
    }
  }
  for (const exp of expenses) {
    if (!exp.effectiveDate) continue;
    const raw = exp.effectiveDate as unknown;
    const iso = raw instanceof Date ? raw.toISOString().slice(0, 7) : String(raw).slice(0, 7);
    const bucket = map.get(iso);
    if (bucket) bucket.expensesUsd += Number(exp.amountUsd ?? 0);
  }

  const result = Array.from(map.values()).map((m) => ({
    ...m,
    netUsd: m.incomesUsd - m.expensesUsd,
  }));

  // Attach baseline for first month MoM vs previous
  if (baseline) {
    if (result.length > 0) {
      result[0].prevIncomesUsd = baseline.incomesUsd;
      result[0].prevExpensesUsd = baseline.expensesUsd;
      result[0].prevNetUsd = baseline.incomesUsd - baseline.expensesUsd;
    }
    for (let i = 1; i < result.length; i++) {
      result[i].prevIncomesUsd = result[i - 1].incomesUsd;
      result[i].prevExpensesUsd = result[i - 1].expensesUsd;
      result[i].prevNetUsd = result[i - 1].netUsd;
    }
  } else {
    for (let i = 1; i < result.length; i++) {
      result[i].prevIncomesUsd = result[i - 1].incomesUsd;
      result[i].prevExpensesUsd = result[i - 1].expensesUsd;
      result[i].prevNetUsd = result[i - 1].netUsd;
    }
  }

  return result;
}

export function computeTrend(series: MonthBucket[]): {
  slope: number;
  intercept: number;
  withTrend: MonthBucket[];
} {
  const n = series.length;
  if (n === 0) return { slope: 0, intercept: 0, withTrend: series };

  const xs = series.map((_, i) => i);
  const ys = series.map((m) => m.netUsd);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const meanX = sumX / n;
  const meanY = sumY / n;
  const intercept = meanY - slope * meanX;

  const withTrend = series.map((m, i) => ({
    ...m,
    trendNetUsd: intercept + slope * i,
  }));

  return { slope, intercept, withTrend };
}

export function countActiveMonths(series: MonthBucket[]): number {
  return series.filter((m) => m.incomesUsd !== 0 || m.expensesUsd !== 0).length;
}

export function hasSufficientTrendData(series: MonthBucket[]): boolean {
  return series.length >= 3 && countActiveMonths(series) >= 3;
}

export function classifyTrend(
  slope: number,
  series: MonthBucket[],
): { classification: "Favorable" | "Desfavorable" | "Estable" | "Datos insuficientes"; threshold: number; activeMonths: number } {
  const activeMonths = countActiveMonths(series);
  if (!hasSufficientTrendData(series)) return { classification: "Datos insuficientes", threshold: 0, activeMonths };
  const n = series.length;
  const totalIncomes = series.reduce((s, m) => s + m.incomesUsd, 0);
  const totalExpenses = series.reduce((s, m) => s + m.expensesUsd, 0);
  const avgMonthlyIncome = totalIncomes / n;
  const avgMonthlyExpense = totalExpenses / n;
  let threshold = 0;
  if (avgMonthlyIncome > 0) threshold = 0.02 * avgMonthlyIncome;
  else if (avgMonthlyExpense > 0) threshold = 0.02 * avgMonthlyExpense;
  else threshold = 0;

  if (threshold === 0) return { classification: "Estable", threshold: 0, activeMonths };

  if (Math.abs(slope) <= threshold) return { classification: "Estable", threshold, activeMonths };
  if (slope > threshold) return { classification: "Favorable", threshold, activeMonths };
  return { classification: "Desfavorable", threshold, activeMonths };
}

export function kpisForSeries(series: MonthBucket[]) {
  const totalIncomes = series.reduce((s, m) => s + m.incomesUsd, 0);
  const totalExpenses = series.reduce((s, m) => s + m.expensesUsd, 0);
  const net = totalIncomes - totalExpenses;
  const n = series.length || 1;
  return {
    totalIncomes,
    totalExpenses,
    net,
    avgNet: net / n,
    avgMonthlyIncome: totalIncomes / n,
    avgMonthlyExpense: totalExpenses / n,
  };
}

export function pctVsPrev(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

export function executivePhrase(
  classification: string,
  slope: number,
  count: number,
): string {
  if (count < 3 || classification === "Datos insuficientes") return "Datos insuficientes para determinar una tendencia financiera en el período.";
  if (classification === "Estable") return "Tendencia estable: no se observa una variación mensual significativa del resultado neto durante el período.";
  if (classification === "Favorable")
    return `Tendencia favorable: el resultado neto viene mejorando aproximadamente US$ ${Math.abs(Math.round(slope)).toLocaleString("es-AR")} por mes durante el período.`;
  return `Tendencia desfavorable: el resultado neto viene deteriorándose aproximadamente US$ ${Math.abs(Math.round(slope)).toLocaleString("es-AR")} por mes durante el período.`;
}
