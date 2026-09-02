import { describe, it, expect } from "vitest";
import { dateOnlyKey, isDateOnlyInRange } from "@/lib/dates";

describe("dateOnlyKey", () => {
  it("2026-09-01T00:00:00.000Z -> 2026-09-01", () => {
    expect(dateOnlyKey("2026-09-01T00:00:00.000Z")).toBe("2026-09-01");
  });
  it("2026-09-01 string -> 2026-09-01", () => {
    expect(dateOnlyKey("2026-09-01")).toBe("2026-09-01");
  });
  it("Date object UTC 2026-09-01 -> 2026-09-01", () => {
    expect(dateOnlyKey(new Date("2026-09-01T00:00:00.000Z"))).toBe("2026-09-01");
  });
  it("null -> null", () => {
    expect(dateOnlyKey(null)).toBeNull();
  });
  it("undefined -> null", () => {
    expect(dateOnlyKey(undefined)).toBeNull();
  });
});

describe("isDateOnlyInRange", () => {
  it("2026-09-01T00:00:00.000Z in 2026-09-01 to 2026-09-30", () => {
    expect(isDateOnlyInRange("2026-09-01T00:00:00.000Z", "2026-09-01", "2026-09-30")).toBe(true);
  });
  it("2026-09-30 included", () => {
    expect(isDateOnlyInRange("2026-09-30", "2026-09-01", "2026-09-30")).toBe(true);
  });
  it("2026-08-31 excluded", () => {
    expect(isDateOnlyInRange("2026-08-31", "2026-09-01", "2026-09-30")).toBe(false);
  });
  it("2026-10-01 excluded", () => {
    expect(isDateOnlyInRange("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
  });
  it("Date object 2026-09-01", () => {
    expect(isDateOnlyInRange(new Date("2026-09-01T00:00:00.000Z"), "2026-09-01", "2026-09-30")).toBe(true);
  });
  it("null not included", () => {
    expect(isDateOnlyInRange(null, "2026-09-01", "2026-09-30")).toBe(false);
  });
});

describe("orden por fecha relevante", () => {
  function relevantKey(inc: { status: string; effectiveDate: any; dueDate: any }) {
    return dateOnlyKey(inc.status === "PAID" ? inc.effectiveDate : inc.dueDate) ?? "";
  }
  function sortIncomes(list: Array<{ status: string; effectiveDate: any; dueDate: any; id: string }>) {
    return [...list].sort((a, b) => relevantKey(b).localeCompare(relevantKey(a)));
  }

  it("PAID ordena por effectiveDate desc", () => {
    const list = [
      { id: "a", status: "PAID", effectiveDate: "2026-09-01", dueDate: null },
      { id: "b", status: "PAID", effectiveDate: "2026-09-25", dueDate: null },
      { id: "c", status: "PAID", effectiveDate: "2026-09-13", dueDate: null },
    ];
    expect(sortIncomes(list).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("PENDING ordena por dueDate desc", () => {
    const list = [
      { id: "a", status: "PENDING", effectiveDate: null, dueDate: "2026-09-01" },
      { id: "b", status: "PENDING", effectiveDate: null, dueDate: "2026-09-20" },
      { id: "c", status: "PENDING", effectiveDate: null, dueDate: "2026-09-10" },
    ];
    expect(sortIncomes(list).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("MIXTO PAID y PENDING", () => {
    const list = [
      { id: "paid25", status: "PAID", effectiveDate: "2026-09-25", dueDate: null },
      { id: "pending20", status: "PENDING", effectiveDate: null, dueDate: "2026-09-20" },
      { id: "paid01", status: "PAID", effectiveDate: "2026-09-01", dueDate: null },
    ];
    expect(sortIncomes(list).map((x) => x.id)).toEqual(["paid25", "pending20", "paid01"]);
  });

  it("mismo helper para gastos", () => {
    const list = [
      { id: "a", status: "PAID", effectiveDate: "2026-09-10", dueDate: null },
      { id: "b", status: "PENDING", effectiveDate: null, dueDate: "2026-09-15" },
    ];
    expect(sortIncomes(list).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
