import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/periods";
import { formatUsd, formatArs } from "@/lib/money";
import { formatDate } from "@/lib/dates";

describe("resolvePeriod", () => {
  it("this-month defaults correctly", () => {
    const p = resolvePeriod("this-month", null, null);
    const now = new Date();
    expect(p.from.getDate()).toBe(1);
    expect(p.from.getMonth()).toBe(now.getMonth());
    expect(p.to.getDate()).toBeLessThanOrEqual(31);
    expect(p.prevFrom.getMonth()).toBe(now.getMonth() === 0 ? 11 : now.getMonth() - 1);
  });

  it("last-month returns full previous month", () => {
    const p = resolvePeriod("last-month", null, null);
    expect(p.from.getDate()).toBe(1);
    expect(p.to.getDate()).toBeGreaterThanOrEqual(28);
    expect(p.from < p.to).toBe(true);
    expect(p.prevFrom < p.from).toBe(true);
  });

  it("this-year returns from Jan 1 to today", () => {
    const p = resolvePeriod("this-year", null, null);
    expect(p.from.getMonth()).toBe(0);
    expect(p.from.getDate()).toBe(1);
    expect(p.to.getFullYear()).toBe(new Date().getFullYear());
  });

  it("custom range inclusive", () => {
    const p = resolvePeriod("custom", "2026-01-01", "2026-01-31");
    expect(p.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(p.to.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("invalid custom falls back to this-month", () => {
    const p = resolvePeriod("custom", "invalid", "2026-01-01");
    expect(p.from.getDate()).toBe(1);
  });

  it("inverted dates fall back to this-month", () => {
    const p = resolvePeriod("custom", "2026-12-01", "2026-01-01");
    expect(p.from.getDate()).toBe(1);
  });

  it("spanning year boundary works", () => {
    const p = resolvePeriod("custom", "2025-12-15", "2026-01-15");
    expect(p.from < p.to).toBe(true);
  });

  it("this-month prevFrom adjusts if prev month has fewer days", () => {
    const p = resolvePeriod("this-month", null, null);
    const prevMonthDays = new Date(p.prevFrom.getFullYear(), p.prevFrom.getMonth() + 1, 0).getDate();
    expect(p.prevTo.getDate()).toBeLessThanOrEqual(prevMonthDays);
  });
});

describe("formatters", () => {
  it("formatUsd uses es-AR locale", () => {
    expect(formatUsd(1000)).toContain("1.000");
    expect(formatUsd(0)).toContain("0,00");
  });

  it("formatArs uses ARS format", () => {
    expect(formatArs(1000000)).toContain("1.000.000");
  });

  it("formatDate produces dd/mm/yyyy", () => {
    const d = formatDate("2026-07-18");
    expect(d).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("formatUsd handles null", () => {
    expect(formatUsd(null)).toBe("—");
  });

  it("formatUsd handles Decimal-like objects", () => {
    expect(formatUsd({ toString: () => "150.50" })).toContain("150,50");
  });
});
