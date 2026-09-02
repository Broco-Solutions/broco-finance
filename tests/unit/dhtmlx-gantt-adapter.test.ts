import { describe, it, expect } from "vitest";
import { toDhtmlxData } from "@/components/projects/dhtmlx/project-gantt-adapter";
import type { PhaseDTO, TaskDTO } from "@/components/projects/dhtmlx/project-gantt-types";

const phase = (id: string, name: string, position = 0): PhaseDTO => ({ id, name, position });
const task = (over: Partial<TaskDTO>): TaskDTO => ({
  id: "t1",
  phaseId: null,
  name: "Tarea",
  description: null,
  type: "TASK",
  startDate: "2026-01-01",
  endDate: "2026-01-10",
  status: "TODO",
  position: 0,
  clientVisible: true,
  ...over,
});

type DTask = {
  id: string;
  text: string;
  type?: string;
  parent?: string | number;
  start_date?: Date;
  end_date?: Date;
  status?: string;
};

describe("toDhtmlxData", () => {
  it("mapea phase → project y ordena por position", () => {
    const phases = [phase("p2", "Desarrollo", 1), phase("p1", "Diseño", 0)];
    const tasks = [
      task({ id: "a", phaseId: "p1", position: 1 }),
      task({ id: "b", phaseId: "p1", position: 0 }),
      task({ id: "c", phaseId: "p2", position: 0 }),
    ];
    const out = toDhtmlxData(phases, tasks, null) as DTask[];
    const p1 = out.find((t) => t.id === "p1");
    const p2 = out.find((t) => t.id === "p2");
    expect(out[0].id).toBe("p1");
    expect(p1?.type).toBe("project");
    expect(out.indexOf(p2!)).toBeGreaterThan(out.indexOf(p1!));
    // tasks dentro de la fase, ordenadas por position
    const b = out.find((t) => t.id === "b");
    const a = out.find((t) => t.id === "a");
    expect(b?.parent).toBe("p1");
    expect(a?.parent).toBe("p1");
    expect(out.indexOf(b!)).toBeLessThan(out.indexOf(a!));
  });

  it("TASK → type task con fechas", () => {
    const out = toDhtmlxData([], [task({ startDate: "2026-02-01", endDate: "2026-02-05" })], null) as DTask[];
    expect(out[0].type).toBe("task");
    expect(out[0].start_date?.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(out[0].end_date?.toISOString().slice(0, 10)).toBe("2026-02-05");
  });

  it("MILESTONE → type milestone con start = end", () => {
    const out = toDhtmlxData([], [task({ type: "MILESTONE", startDate: "2026-03-15", endDate: "2026-03-15" })], null) as DTask[];
    expect(out[0].type).toBe("milestone");
    expect(out[0].start_date?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(out[0].end_date?.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("omite fases sin tareas", () => {
    const phases = [phase("p1", "Con tareas", 0), phase("p2", "Vacía", 1)];
    const tasks = [task({ id: "a", phaseId: "p1" })];
    const out = toDhtmlxData(phases, tasks, null) as DTask[];
    expect(out.find((t) => t.id === "p2")).toBeUndefined();
    expect(out.find((t) => t.id === "p1")).toBeDefined();
  });

  it("tareas sin fase quedan a nivel raíz (parent 0)", () => {
    const out = toDhtmlxData([], [task({ id: "x", phaseId: null })], null) as DTask[];
    expect(out[0].parent).toBe(0);
  });

  it("Go Live se agrega como milestone sintético", () => {
    const out = toDhtmlxData([], [], "2026-12-18") as DTask[];
    const go = out.find((t) => t.id === "go-live");
    expect(go).toBeDefined();
    expect(go?.type).toBe("milestone");
    expect(go?.start_date?.toISOString().slice(0, 10)).toBe("2026-12-18");
  });

  it("sin goLiveDate no genera marcador", () => {
    const out = toDhtmlxData([], [], null) as DTask[];
    expect(out.find((t) => t.id === "go-live")).toBeUndefined();
  });
});
describe("toDhtmlxData filtrado y Go Live", () => {
  const phases = [phase("p1", "Descubrimiento", 0), phase("p2", "Desarrollo", 1)];
  const tasks = [
    task({ id: "t1", phaseId: "p1", name: "Tarea", status: "IN_PROGRESS" }),
    task({ id: "m1", phaseId: "p1", name: "Hito", type: "MILESTONE", status: "DONE" }),
    task({ id: "t2", phaseId: "p2", name: "Otra" }),
  ];

  it("filtro tipo milestone conserva fase padre y omite tareas", () => {
    const out = toDhtmlxData(phases, tasks, null, { type: "milestone", status: "all" }) as DTask[];
    expect(out.find((t) => t.id === "p1")).toBeDefined();
    expect(out.find((t) => t.id === "m1")).toBeDefined();
    expect(out.find((t) => t.id === "t1")).toBeUndefined();
    // fase sin hitos se omite
    expect(out.find((t) => t.id === "p2")).toBeUndefined();
  });

  it("filtro estado conserva fase con hijos que coinciden", () => {
    const out = toDhtmlxData(phases, tasks, null, { type: "all", status: "IN_PROGRESS" }) as DTask[];
    expect(out.find((t) => t.id === "p1")).toBeDefined();
    expect(out.find((t) => t.id === "t1")).toBeDefined();
    expect(out.find((t) => t.id === "t2")).toBeUndefined();
    expect(out.find((t) => t.id === "p2")).toBeUndefined();
  });

  it("Go Live sintético se omite si ya existe un hito llamado Go Live", () => {
    const withGoLive = [...tasks, task({ id: "gl", phaseId: null, name: "Go Live", type: "MILESTONE", startDate: "2026-12-18", endDate: "2026-12-18" })];
    const out = toDhtmlxData(phases, withGoLive, "2026-12-18", { type: "all", status: "all" }) as DTask[];
    expect(out.filter((t) => t.id === "go-live" || t.id === "gl")).toHaveLength(1);
  });

  it("Go Live sintético aparece cuando no hay tarea homónima", () => {
    const out = toDhtmlxData(phases, tasks, "2026-12-18", { type: "all", status: "all" }) as DTask[];
    expect(out.find((t) => t.id === "go-live")).toBeDefined();
  });
});
