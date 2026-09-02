import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/server/services/clients";
import { createProject } from "@/server/services/projects";
import { createPhase } from "@/server/services/project-phases";
import { createTask, updateTask, reorderProjectTasks } from "@/server/services/project-tasks";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientId: string;
let projectAId: string;
let projectBId: string;
let phaseAId: string;
let phaseBId: string;
let taskAId: string;
let taskBId: string;
let taskCId: string;
let taskBOtherId: string;

beforeAll(async () => {
  if (skip) return;
  const client = await prisma.client.create({ data: { name: `reorder-${Date.now()}` } });
  clientId = client.id;
  const pA = await prisma.project.create({ data: { clientId, name: "Reorder A" } });
  projectAId = pA.id;
  const pB = await prisma.project.create({ data: { clientId, name: "Reorder B" } });
  projectBId = pB.id;
  const phA = await createPhase({ projectId: projectAId, name: "Fase A" });
  phaseAId = phA.id;
  const phB = await createPhase({ projectId: projectAId, name: "Fase B" });
  phaseBId = phB.id;

  const a = await createTask({ projectId: projectAId, phaseId: phaseAId, name: "A", startDate: "2026-01-01", endDate: "2026-01-02" });
  const b = await createTask({ projectId: projectAId, phaseId: phaseAId, name: "B", startDate: "2026-01-03", endDate: "2026-01-04" });
  const c = await createTask({ projectId: projectAId, phaseId: phaseAId, name: "C", startDate: "2026-01-05", endDate: "2026-01-06" });
  const other = await createTask({ projectId: projectBId, name: "Otra", startDate: "2026-01-07", endDate: "2026-01-08" });
  taskAId = a.id;
  taskBId = b.id;
  taskCId = c.id;
  taskBOtherId = other.id;
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  await prisma.projectTask.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } });
  await prisma.projectPhase.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("reorderProjectTasks", () => {
  it("reordena dentro de la misma fase", async () => {
    await reorderProjectTasks(projectAId, phaseAId, [taskCId, taskAId, taskBId]);
    const rows = await prisma.projectTask.findMany({
      where: { id: { in: [taskAId, taskBId, taskCId] } },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    expect(rows.map((r) => r.id)).toEqual([taskCId, taskAId, taskBId]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("rechaza tarea de otra fase", async () => {
    await expect(reorderProjectTasks(projectAId, phaseAId, [taskAId, taskBId, taskCId, taskBOtherId])).rejects.toThrow(/otra fase|incompleta/);
  });

  it("rechaza ids de otro proyecto", async () => {
    await expect(reorderProjectTasks(projectAId, phaseAId, [taskAId, taskBId, taskBOtherId])).rejects.toThrow();
  });

  it("rechaza ids repetidos", async () => {
    await expect(reorderProjectTasks(projectAId, phaseAId, [taskAId, taskAId, taskBId])).rejects.toThrow(/repetidos/);
  });

  it("rechaza lista incompleta", async () => {
    await expect(reorderProjectTasks(projectAId, phaseAId, [taskAId, taskBId])).rejects.toThrow(/incompleta/);
  });

  it("rechaza proyecto inexistente", async () => {
    await expect(
      reorderProjectTasks("00000000-0000-0000-0000-000000000000", phaseAId, [taskAId, taskBId, taskCId]),
    ).rejects.toThrow(/no encontrado/);
  });
});

describe.skipIf(skip)("scheduling de fechas vía updateTask", () => {
  it("TASK con start > end es rechazada por el servicio", async () => {
    await expect(
      updateTask(taskAId, { startDate: "2026-02-10", endDate: "2026-02-01" }),
    ).rejects.toThrow(/anterior/);
  });

  it("MILESTONE normaliza end = start en la capa de servicio", async () => {
    const m = await createTask({ projectId: projectAId, phaseId: phaseAId, name: "Hito", type: "MILESTONE", startDate: "2026-05-01", endDate: "2026-05-99" });
    const stored = await prisma.projectTask.findUnique({ where: { id: m.id } });
    expect(stored!.startDate!.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(stored!.endDate!.toISOString().slice(0, 10)).toBe("2026-05-01");
  });
});