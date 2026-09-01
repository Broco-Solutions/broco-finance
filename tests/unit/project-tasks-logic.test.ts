import { describe, it, expect } from "vitest";
import { resolveTaskDates } from "@/server/services/project-tasks";

describe("resolveTaskDates", () => {
  it("TASK: normaliza fechas y exige start <= end", () => {
    const r = resolveTaskDates("TASK", "2026-01-01", "2026-01-10");
    expect(r.startDate.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.endDate.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  it("TASK: lanza si start > end", () => {
    expect(() => resolveTaskDates("TASK", "2026-01-10", "2026-01-01")).toThrow();
  });

  it("MILESTONE: normaliza end = start (una sola fecha lógica)", () => {
    const r = resolveTaskDates("MILESTONE", "2026-03-15", "2026-03-99");
    expect(r.startDate.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(r.endDate.toISOString().slice(0, 10)).toBe("2026-03-15");
  });
});
