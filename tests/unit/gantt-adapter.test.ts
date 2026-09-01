import { describe, it, expect } from "vitest";
import {
  mapToGanttTasks,
  statusToClass,
  statusLabel,
  type TaskDTO,
  type PhaseDTO,
} from "@/components/projects/gantt-adapter";

const phase = (id: string, name: string, position = 0): PhaseDTO => ({ id, name, position });

const task = (over: Partial<TaskDTO>): TaskDTO => ({
  id: "t1",
  phaseId: null,
  name: "Tarea",
  description: null,
  type: "TASK",
  startDate: "2026-01-01",
  endDate: "2026-01-05",
  status: "TODO",
  position: 0,
  clientVisible: true,
  ...over,
});

describe("statusToClass / statusLabel", () => {
  it("mapea status a clase visual", () => {
    expect(statusToClass("DONE")).toBe("gantt-status-done");
    expect(statusToClass("BLOCKED")).toBe("gantt-status-blocked");
    expect(statusToClass("TODO")).toBe("gantt-status-todo");
  });
  it("mapea status a label en español", () => {
    expect(statusLabel("IN_PROGRESS")).toBe("En progreso");
    expect(statusLabel("TO_REVIEW")).toBe("A revisar");
  });
});

describe("mapToGanttTasks", () => {
  it("TASK: barra con fechas y clase de status, sin progreso", () => {
    const tasks = [task({ id: "a", status: "DONE", startDate: "2026-02-01", endDate: "2026-02-10" })];
    const out = mapToGanttTasks([], tasks, null);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("task");
    expect(out[0].start).toBe("2026-02-01");
    expect(out[0].end).toBe("2026-02-10");
    expect(out[0].custom_class).toContain("gantt-status-done");
    expect(out[0].statusLabel).toBe("Hecho");
  });

  it("MILESTONE: clase de hito y fin = inicio + 1 día", () => {
    const tasks = [task({ id: "m", type: "MILESTONE", startDate: "2026-03-15" })];
    const out = mapToGanttTasks([], tasks, null);
    expect(out[0].custom_class).toContain("gantt-milestone");
    expect(out[0].start).toBe("2026-03-15");
    expect(out[0].end).toBe("2026-03-16");
  });

  it("agrupa por fase y omite fases sin tareas", () => {
    const phases = [phase("p1", "Fase 1", 0), phase("p2", "Fase 2", 1)];
    const tasks = [
      task({ id: "a", phaseId: "p1", position: 0 }),
      task({ id: "b", phaseId: "p1", position: 1 }),
      task({ id: "c", phaseId: null, position: 0 }),
    ];
    const out = mapToGanttTasks(phases, tasks, null);
    const phaseBars = out.filter((t) => t.custom_class === "gantt-phase");
    expect(phaseBars).toHaveLength(1); // solo p1 (p2 sin tareas se omite)
    expect(phaseBars[0].name).toBe("Fase 1");
    const p1Idx = out.findIndex((t) => t.id === "phase-p1");
    const aIdx = out.findIndex((t) => t.id === "task-a");
    const bIdx = out.findIndex((t) => t.id === "task-b");
    expect(p1Idx).toBeLessThan(aIdx);
    expect(aIdx).toBeLessThan(bIdx);
    const cIdx = out.findIndex((t) => t.id === "task-c");
    expect(cIdx).toBeGreaterThan(bIdx); // tarea sin fase después de las fases
  });

  it("Go Live: genera marcador sin crear ProjectTask", () => {
    const out = mapToGanttTasks([], [], "2026-07-01");
    const go = out.find((t) => t.id === "go-live");
    expect(go).toBeDefined();
    expect(go!.name).toBe("Go Live");
    expect(go!.custom_class).toContain("gantt-go-live");
    expect(go!.start).toBe("2026-07-01");
    expect(go!.end).toBe("2026-07-02");
  });

  it("sin goLiveDate no genera marcador", () => {
    const out = mapToGanttTasks([], [], null);
    expect(out.find((t) => t.id === "go-live")).toBeUndefined();
  });
});
