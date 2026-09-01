import { describe, it, expect } from "vitest";
import {
  computeProjectProgress,
  computeElapsedPercent,
  resolveGoLive,
} from "@/lib/project-progress";

describe("computeProjectProgress", () => {
  it("cuenta solo TASK para el porcentaje y excluye MILESTONE", () => {
    const r = computeProjectProgress([
      { type: "TASK", status: "DONE" },
      { type: "TASK", status: "TODO" },
      { type: "MILESTONE", status: "DONE" },
    ]);
    expect(r.totalTasks).toBe(2);
    expect(r.doneTasks).toBe(1);
    expect(r.percent).toBe(50);
    expect(r.hasTasks).toBe(true);
  });

  it("devuelve null y hasTasks=false cuando no hay TASK", () => {
    const r = computeProjectProgress([
      { type: "MILESTONE", status: "DONE" },
      { type: "MILESTONE", status: "TODO" },
    ]);
    expect(r.totalTasks).toBe(0);
    expect(r.doneTasks).toBe(0);
    expect(r.hasTasks).toBe(false);
    expect(r.percent).toBeNull();
  });

  it("filtra clientVisible cuando se pide", () => {
    const r = computeProjectProgress(
      [
        { type: "TASK", status: "DONE", clientVisible: true },
        { type: "TASK", status: "TODO", clientVisible: false },
        { type: "TASK", status: "TODO", clientVisible: true },
      ],
      { onlyClientVisible: true },
    );
    expect(r.totalTasks).toBe(2);
    expect(r.doneTasks).toBe(1);
    expect(r.percent).toBe(50);
  });

  it("0% cuando hay TASK pero ninguna en DONE", () => {
    const r = computeProjectProgress([
      { type: "TASK", status: "TODO" },
      { type: "TASK", status: "IN_PROGRESS" },
    ]);
    expect(r.percent).toBe(0);
  });
});

describe("computeElapsedPercent", () => {
  const start = "2026-01-01";
  const end = "2026-01-11";

  it("es 0% antes de startDate", () => {
    expect(computeElapsedPercent(start, end, new Date("2025-12-31T12:00:00Z"))).toBe(0);
  });

  it("es 100% después de endDate", () => {
    expect(computeElapsedPercent(start, end, new Date("2026-01-12T00:00:00Z"))).toBe(100);
  });

  it("calcula el porcentaje intermedio", () => {
    expect(computeElapsedPercent(start, end, new Date("2026-01-06T00:00:00Z"))).toBe(50);
  });

  it("es null si falta startDate o endDate", () => {
    expect(computeElapsedPercent(null, end)).toBeNull();
    expect(computeElapsedPercent(start, null)).toBeNull();
  });
});

describe("resolveGoLive", () => {
  it("sin fecha", () => {
    expect(resolveGoLive(null)).toEqual({
      hasDate: false,
      daysRemaining: null,
      isToday: false,
      isPast: false,
    });
  });

  it("fecha futura", () => {
    const s = resolveGoLive("2026-12-31", new Date("2026-09-01T00:00:00Z"));
    expect(s.hasDate).toBe(true);
    expect(s.isToday).toBe(false);
    expect(s.isPast).toBe(false);
    expect(s.daysRemaining).toBeGreaterThan(0);
  });

  it("fecha pasada", () => {
    const s = resolveGoLive("2026-01-01", new Date("2026-09-01T00:00:00Z"));
    expect(s.isPast).toBe(true);
    expect(s.daysRemaining).toBeLessThan(0);
  });

  it("hoy", () => {
    const s = resolveGoLive("2026-09-01", new Date("2026-09-01T00:00:00Z"));
    expect(s.isToday).toBe(true);
    expect(s.daysRemaining).toBe(0);
  });
});
