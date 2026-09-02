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

describe("vencido", () => {
  function isOverdue(status: string, dueDate: string | Date | null) {
    if (status !== "PENDING") return false;
    const todayKey = new Date().toISOString().slice(0, 10);
    // Use dateOnlyKey for comparison (today not overdue)
    const dueKey = dateOnlyKey(dueDate);
    return !!dueKey && dueKey < todayKey;
  }
  it("PENDING ayer vencido", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect(isOverdue("PENDING", yesterday)).toBe(true);
  });
  it("PENDING hoy no vencido", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isOverdue("PENDING", today)).toBe(false);
  });
  it("PENDING mañana no vencido", () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(isOverdue("PENDING", tomorrow)).toBe(false);
  });
  it("PAID ayer no vencido", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect(isOverdue("PAID", yesterday)).toBe(false);
  });
});

describe("próximos 30 días", () => {
  function isUpcoming(dueDate: string | Date | null) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return isDateOnlyInRange(dueDate, todayKey, in30);
  }
  it("vence hoy incluido", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isUpcoming(today)).toBe(true);
  });
  it("vence en 30 incluido", () => {
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    expect(isUpcoming(in30)).toBe(true);
  });
  it("vence en 31 excluido", () => {
    const in31 = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);
    expect(isUpcoming(in31)).toBe(false);
  });
  it("vencido excluido", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect(isUpcoming(yesterday)).toBe(false);
  });
  it("combinado ordenado asc", () => {
    const today = new Date().toISOString().slice(0, 10);
    const in5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const in10 = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const list = [
      { id: "inc", dueDate: in10, kind: "INCOME" },
      { id: "exp", dueDate: today, kind: "EXPENSE" },
      { id: "inc2", dueDate: in5, kind: "INCOME" },
    ];
    const sorted = [...list].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    expect(sorted.map((x) => x.id)).toEqual(["exp", "inc2", "inc"]);
  });
});

describe("id filter", () => {
  function filterById(list: Array<{ id: string }>, id: string | null) {
    if (!id) return list;
    return list.filter((x) => x.id === id);
  }
  it("/incomes id=A solo A", () => {
    const list = [{ id: "A" }, { id: "B" }];
    expect(filterById(list, "A")).toEqual([{ id: "A" }]);
  });
  it("/expenses id=B solo B", () => {
    const list = [{ id: "A" }, { id: "B" }];
    expect(filterById(list, "B")).toEqual([{ id: "B" }]);
  });
  it("id inexistente 0", () => {
    const list = [{ id: "A" }];
    expect(filterById(list, "Z")).toEqual([]);
  });
});
