import { describe, it, expect } from "vitest";
import {
  getEvolutionMonths,
  bucketByMonth,
  computeTrend,
  classifyTrend,
  kpisForSeries,
  executivePhrase,
  pctVsPrev,
  hasSufficientTrendData,
} from "@/lib/financial-trend";

describe("getEvolutionMonths", () => {
  it("6m: mar->ago 2026 para 02/09/2026", () => {
    const m = getEvolutionMonths("2026-09-02", "6m");
    expect(m.map((x) => `${x.year}-${String(x.month).padStart(2, "0")}`)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });
  it("12m: sep 2025->ago 2026", () => {
    const m = getEvolutionMonths("2026-09-02", "12m");
    expect(m.length).toBe(12);
    expect(m[0].year).toBe(2025);
    expect(m[0].month).toBe(9);
    expect(m[11].year).toBe(2026);
    expect(m[11].month).toBe(8);
  });
  it("cruce de año 12m desde feb", () => {
    const m = getEvolutionMonths("2026-02-15", "12m");
    expect(m[0]).toMatchObject({ year: 2025, month: 2 });
    expect(m[11]).toMatchObject({ year: 2026, month: 1 });
    expect(m.length).toBe(12);
  });
  it("año actual ene->ago 2026", () => {
    const m = getEvolutionMonths("2026-09-02", "year");
    expect(m[0]).toMatchObject({ year: 2026, month: 1 });
    expect(m[m.length - 1]).toMatchObject({ year: 2026, month: 8 });
  });
  it("año actual enero sin cerrados", () => {
    const m = getEvolutionMonths("2026-01-15", "year");
    expect(m.length).toBe(0);
  });
  it("feb bisiesto", () => {
    const b = getEvolutionMonths("2024-03-10", "6m");
    // last closed Feb 2024 (leap), should include Feb
    expect(b.some((x) => x.year === 2024 && x.month === 2)).toBe(true);
  });
});

describe("bucketByMonth zero-fill", () => {
  it("mes sin movimientos cero", () => {
    const months = getEvolutionMonths("2026-09-02", "6m");
    const incomes: any[] = [];
    const expenses: any[] = [];
    const res = bucketByMonth(months, incomes, expenses);
    expect(res.every((m) => m.incomesUsd === 0 && m.expensesUsd === 0 && m.netUsd === 0)).toBe(true);
  });
  it("agrupa por effectiveDate PAID", () => {
    const months = getEvolutionMonths("2026-09-02", "6m");
    const incomes = [{ effectiveDate: new Date("2026-08-15"), amountUsd: 100 }];
    const expenses = [{ effectiveDate: new Date("2026-08-20"), amountUsd: 40 }];
    const res = bucketByMonth(months, incomes as any, expenses as any);
    const aug = res.find((m) => m.month === 8);
    expect(aug?.incomesUsd).toBe(100);
    expect(aug?.expensesUsd).toBe(40);
    expect(aug?.netUsd).toBe(60);
  });
});

describe("kpis", () => {
  it("promedio incluye ceros", () => {
    const months = [
      { year: 2026, month: 8, label: "ago", fromISO: "2026-08-01", toISO: "2026-08-31", incomesUsd: 100, expensesUsd: 0, netUsd: 100 },
      { year: 2026, month: 7, label: "jul", fromISO: "2026-07-01", toISO: "2026-07-31", incomesUsd: 0, expensesUsd: 0, netUsd: 0 },
    ] as any;
    const k = kpisForSeries(months);
    expect(k.net).toBe(100);
    expect(k.avgNet).toBe(50);
  });
});

describe("trend", () => {
  it("slope positiva", () => {
    const series = [{ netUsd: 0 }, { netUsd: 100 }, { netUsd: 200 }] as any;
    const { slope } = computeTrend(series);
    expect(slope).toBeGreaterThan(0);
  });
  it("slope negativa", () => {
    const series = [{ netUsd: 200 }, { netUsd: 100 }, { netUsd: 0 }] as any;
    const { slope } = computeTrend(series);
    expect(slope).toBeLessThan(0);
  });
  it("slope cero estable", () => {
    const series = [{ netUsd: 100 }, { netUsd: 100 }, { netUsd: 100 }] as any;
    const { slope } = computeTrend(series);
    expect(Math.abs(slope)).toBeLessThan(0.01);
  });
  it("threshold favorable", () => {
    const series = [
      { netUsd: 0, incomesUsd: 5000, expensesUsd: 0 },
      { netUsd: 300, incomesUsd: 5000, expensesUsd: 0 },
      { netUsd: 600, incomesUsd: 5000, expensesUsd: 0 },
    ] as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(classification).toBe("Favorable");
  });
  it("threshold estable con slope pequeño", () => {
    const series = [
      { netUsd: 0, incomesUsd: 5000, expensesUsd: 0 },
      { netUsd: 40, incomesUsd: 5000, expensesUsd: 0 },
      { netUsd: 80, incomesUsd: 5000, expensesUsd: 0 },
    ] as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(classification).toBe("Estable");
  });
  it("ambos cero con 3 meses pero 0 activos -> insuficiente", () => {
    const series = [
      { netUsd: 0, incomesUsd: 0, expensesUsd: 0 },
      { netUsd: 0, incomesUsd: 0, expensesUsd: 0 },
      { netUsd: 0, incomesUsd: 0, expensesUsd: 0 },
    ] as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(classification).toBe("Datos insuficientes");
  });
  it("menos de 3 meses datos insuficientes", () => {
    const series = [{ netUsd: 100, incomesUsd: 1000, expensesUsd: 0 }] as any;
    const { classification } = classifyTrend(100, series);
    expect(classification).toBe("Datos insuficientes");
  });
  it("12 meses 1 activo -> insuficiente", () => {
    const series = Array.from({ length: 12 }, (_, i) => ({
      netUsd: i === 5 ? 100 : 0,
      incomesUsd: i === 5 ? 100 : 0,
      expensesUsd: 0,
    })) as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(classification).toBe("Datos insuficientes");
  });
  it("12 meses 2 activos -> insuficiente", () => {
    const series = Array.from({ length: 12 }, (_, i) => ({
      netUsd: i < 2 ? 100 : 0,
      incomesUsd: i < 2 ? 100 : 0,
      expensesUsd: 0,
    })) as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(classification).toBe("Datos insuficientes");
  });
  it("12 meses 3 activos -> habilitada", () => {
    const series = Array.from({ length: 12 }, (_, i) => ({
      netUsd: i < 3 ? 100 : 0,
      incomesUsd: i < 3 ? 100 : 0,
      expensesUsd: 0,
    })) as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(["Favorable", "Estable", "Desfavorable"]).toContain(classification);
  });
  it("6 meses 3 activos -> habilitada", () => {
    const series = Array.from({ length: 6 }, (_, i) => ({
      netUsd: i < 3 ? 100 : 0,
      incomesUsd: i < 3 ? 100 : 0,
      expensesUsd: 0,
    })) as any;
    const { slope } = computeTrend(series);
    const { classification } = classifyTrend(slope, series);
    expect(["Favorable", "Estable", "Desfavorable"]).toContain(classification);
  });
});

describe("pctVsPrev", () => {
  it("aumento", () => {
    expect(pctVsPrev(120, 100)).toBeCloseTo(20);
  });
  it("caída", () => {
    expect(pctVsPrev(80, 100)).toBeCloseTo(-20);
  });
  it("prev 0 null", () => {
    expect(pctVsPrev(100, 0)).toBeNull();
  });
});

describe("executivePhrase", () => {
  it("favorable", () => {
    expect(executivePhrase("Favorable", 320, 12)).toMatch(/favorable/i);
  });
  it("desfavorable", () => {
    expect(executivePhrase("Desfavorable", -185, 12)).toMatch(/desfavorable/i);
  });
  it("estable", () => {
    expect(executivePhrase("Estable", 2, 12)).toMatch(/estable/i);
  });
  it("insuficientes", () => {
    expect(executivePhrase("Datos insuficientes", 0, 2)).toMatch(/insuficientes/i);
  });
});

describe("hasSufficientTrendData", () => {
  it("1 activo -> false", () => {
    const s = Array.from({ length: 12 }, (_, i) => ({ incomesUsd: i === 0 ? 100 : 0, expensesUsd: 0, netUsd: i === 0 ? 100 : 0 })) as any;
    expect(hasSufficientTrendData(s)).toBe(false);
  });
  it("2 activos -> false", () => {
    const s = Array.from({ length: 12 }, (_, i) => ({ incomesUsd: i < 2 ? 100 : 0, expensesUsd: 0, netUsd: i < 2 ? 100 : 0 })) as any;
    expect(hasSufficientTrendData(s)).toBe(false);
  });
  it("3 activos -> true", () => {
    const s = Array.from({ length: 12 }, (_, i) => ({ incomesUsd: i < 3 ? 100 : 0, expensesUsd: 0, netUsd: i < 3 ? 100 : 0 })) as any;
    expect(hasSufficientTrendData(s)).toBe(true);
  });
  it("3 meses 0 activos -> false", () => {
    const s = Array.from({ length: 3 }, () => ({ incomesUsd: 0, expensesUsd: 0, netUsd: 0 })) as any;
    expect(hasSufficientTrendData(s)).toBe(false);
  });
});
