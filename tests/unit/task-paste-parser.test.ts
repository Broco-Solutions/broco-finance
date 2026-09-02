import { describe, it, expect } from "vitest";
import { parsePastedTasks } from "@/lib/task-paste-parser";

const phases = [
  { id: "p1", name: "Descubrimiento" },
  { id: "p2", name: "Diseño" },
  { id: "p3", name: "Desarrollo" },
];

const defaults = {
  phaseId: null as string | null,
  status: "TODO",
  type: "TASK",
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  clientVisible: true,
};

describe("parsePastedTasks", () => {
  it("una línea", () => {
    const r = parsePastedTasks("Crear API clientes", phases, defaults);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe("Crear API clientes");
    expect(r.rows[0].phaseId).toBe(null);
  });

  it("múltiples líneas", () => {
    const r = parsePastedTasks("A\nB\nC", phases, defaults);
    expect(r.rows).toHaveLength(3);
  });

  it("CRLF", () => {
    const r = parsePastedTasks("A\r\nB\r\nC", phases, defaults);
    expect(r.rows).toHaveLength(3);
  });

  it("TSV con fase y estado", () => {
    const r = parsePastedTasks("Tarea X\tDesarrollo\tEn progreso", phases, defaults);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].phaseId).toBe("p3");
    expect(r.rows[0].status).toBe("IN_PROGRESS");
  });

  it("usa defaults si falta fase", () => {
    const r = parsePastedTasks("Solo nombre", phases, { ...defaults, phaseId: "p2" });
    expect(r.rows[0].phaseId).toBe("p2");
  });

  it("fase case-insensitive", () => {
    const r = parsePastedTasks("T\tdeSarrOllo", phases, defaults);
    expect(r.rows[0].phaseId).toBe("p3");
  });

  it("fase inválida error", () => {
    const r = parsePastedTasks("T\tNoExiste", phases, defaults);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].message).toMatch(/no encontrada/i);
  });

  it("estado inválido error", () => {
    const r = parsePastedTasks("T\tDesarrollo\tEstadoMalo", phases, defaults);
    expect(r.errors.length).toBe(1);
  });

  it("fecha inicio y fin TSV", () => {
    const r = parsePastedTasks("T\tDesarrollo\tPor hacer\t2026-10-01\t2026-10-10", phases, defaults);
    expect(r.rows[0].startDate).toBe("2026-10-01");
    expect(r.rows[0].endDate).toBe("2026-10-10");
  });

  it("fecha DD/MM/YYYY", () => {
    const r = parsePastedTasks("T\tDesarrollo\tPor hacer\t01/10/2026\t10/10/2026", phases, defaults);
    expect(r.rows[0].startDate).toBe("2026-10-01");
  });

  it("tipo hito", () => {
    const r = parsePastedTasks("Hito\tDesarrollo\tPor hacer\t2026-10-01\t2026-10-01\tHito", phases, defaults);
    expect(r.rows[0].type).toBe("MILESTONE");
  });

  it("líneas vacías ignoradas", () => {
    const r = parsePastedTasks("A\n\nB\n  \nC", phases, defaults);
    expect(r.rows).toHaveLength(3);
  });
});
