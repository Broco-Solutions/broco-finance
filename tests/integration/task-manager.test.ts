import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyProjectTaskChanges } from "@/server/services/project-tasks";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientId: string;
let projectId: string;
let otherProjectId: string;
let phaseAId: string;
let phaseBId: string;

beforeAll(async () => {
  if (skip) return;
  const client = await prisma.client.create({ data: { name: `tm-${Date.now()}` } });
  clientId = client.id;
  const p = await prisma.project.create({ data: { clientId, name: "TM Project" } });
  projectId = p.id;
  const p2 = await prisma.project.create({ data: { clientId, name: "TM Other" } });
  otherProjectId = p2.id;
  const phA = await prisma.projectPhase.create({ data: { projectId, name: "Fase A", position: 0 } });
  const phB = await prisma.projectPhase.create({ data: { projectId, name: "Fase B", position: 1 } });
  phaseAId = phA.id;
  phaseBId = phB.id;
  // seed 2 tasks in A
  await prisma.projectTask.create({
    data: { projectId, phaseId: phaseAId, name: "TA", type: "TASK", status: "TODO", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-10"), position: 0, clientVisible: true },
  });
  await prisma.projectTask.create({
    data: { projectId, phaseId: phaseAId, name: "TB", type: "TASK", status: "TODO", startDate: new Date("2026-09-11"), endDate: new Date("2026-09-20"), position: 1, clientVisible: true },
  });
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  await prisma.projectTask.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.projectPhase.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("applyProjectTaskChanges", () => {
  it("crear 1 tarea", async () => {
    await applyProjectTaskChanges({
      projectId,
      creates: [{ name: "Nueva", phaseId: phaseAId, type: "TASK", startDate: "2026-10-01", endDate: "2026-10-10", status: "TODO", clientVisible: true }],
      updates: [],
      deletes: [],
    });
    const found = await prisma.projectTask.findFirst({ where: { projectId, name: "Nueva" } });
    expect(found).toBeTruthy();
    expect(found!.phaseId).toBe(phaseAId);
    await prisma.projectTask.delete({ where: { id: found!.id } });
  });

  it("crear muchas en distintas fases append por fase", async () => {
    await applyProjectTaskChanges({
      projectId,
      creates: [
        { name: "C1", phaseId: phaseAId, type: "TASK", startDate: "2026-10-01", endDate: "2026-10-02", status: "TODO", clientVisible: true },
        { name: "C2", phaseId: phaseBId, type: "TASK", startDate: "2026-10-03", endDate: "2026-10-04", status: "TODO", clientVisible: true },
        { name: "C3", phaseId: phaseAId, type: "TASK", startDate: "2026-10-05", endDate: "2026-10-06", status: "TODO", clientVisible: true },
      ],
      updates: [],
      deletes: [],
    });
    const rows = await prisma.projectTask.findMany({ where: { projectId, name: { in: ["C1", "C2", "C3"] } }, orderBy: { position: "asc" } });
    // C1 and C3 should be in phase A appended, C2 in phase B
    const aRows = await prisma.projectTask.findMany({ where: { projectId, phaseId: phaseAId }, orderBy: { position: "asc" }, select: { name: true, position: true } });
    // Last two in A should be C1, C3 in order
    const aNames = aRows.map((r) => r.name);
    expect(aNames.slice(-2)).toEqual(["C1", "C3"]);
    await prisma.projectTask.deleteMany({ where: { projectId, name: { in: ["C1", "C2", "C3"] } } });
  });

  it("bulk status update", async () => {
    const tasks = await prisma.projectTask.findMany({ where: { projectId, phaseId: phaseAId }, select: { id: true } });
    const ids = tasks.slice(0, 2).map((t) => t.id);
    await applyProjectTaskChanges({
      projectId,
      creates: [],
      updates: ids.map((id) => ({ id, status: "DONE" })),
      deletes: [],
    });
    const updated = await prisma.projectTask.findMany({ where: { id: { in: ids } }, select: { status: true } });
    expect(updated.every((u) => u.status === "DONE")).toBe(true);
    // revert
    await applyProjectTaskChanges({
      projectId,
      creates: [],
      updates: ids.map((id) => ({ id, status: "TODO" })),
      deletes: [],
    });
  });

  it("cambio de fase mueve al final de nueva fase", async () => {
    const task = await prisma.projectTask.findFirst({ where: { projectId, phaseId: phaseAId } });
    await applyProjectTaskChanges({
      projectId,
      creates: [],
      updates: [{ id: task!.id, phaseId: phaseBId }],
      deletes: [],
    });
    const moved = await prisma.projectTask.findUnique({ where: { id: task!.id } });
    expect(moved!.phaseId).toBe(phaseBId);
    // should be last in B
    const bRows = await prisma.projectTask.findMany({ where: { projectId, phaseId: phaseBId }, orderBy: { position: "asc" }, select: { id: true } });
    expect(bRows[bRows.length - 1].id).toBe(task!.id);
    // move back
    await applyProjectTaskChanges({
      projectId,
      creates: [],
      updates: [{ id: task!.id, phaseId: phaseAId }],
      deletes: [],
    });
  });

  it("clientVisible bulk", async () => {
    const t = await prisma.projectTask.findFirst({ where: { projectId } });
    await applyProjectTaskChanges({ projectId, creates: [], updates: [{ id: t!.id, clientVisible: false }], deletes: [] });
    const after = await prisma.projectTask.findUnique({ where: { id: t!.id } });
    expect(after!.clientVisible).toBe(false);
    await applyProjectTaskChanges({ projectId, creates: [], updates: [{ id: t!.id, clientVisible: true }], deletes: [] });
  });

  it("delete individual", async () => {
    const tmp = await prisma.projectTask.create({
      data: { projectId, name: "ToDelete", type: "TASK", status: "TODO", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-02"), position: 999, clientVisible: true },
    });
    await applyProjectTaskChanges({ projectId, creates: [], updates: [], deletes: [tmp.id] });
    const gone = await prisma.projectTask.findUnique({ where: { id: tmp.id } });
    expect(gone).toBeNull();
  });

  it("cross-project reject", async () => {
    const otherTask = await prisma.projectTask.create({
      data: { projectId: otherProjectId, name: "Other", type: "TASK", status: "TODO", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-02"), position: 0, clientVisible: true },
    });
    await expect(
      applyProjectTaskChanges({ projectId, creates: [], updates: [{ id: otherTask.id, name: "Hack" }], deletes: [] }),
    ).rejects.toThrow(/pertenece/);
    await prisma.projectTask.delete({ where: { id: otherTask.id } });
  });

  it("invalid phase reject", async () => {
    const t = await prisma.projectTask.findFirst({ where: { projectId } });
    await expect(
      applyProjectTaskChanges({ projectId, creates: [], updates: [{ id: t!.id, phaseId: "00000000-0000-0000-0000-000000000000" }], deletes: [] }),
    ).rejects.toThrow(/Fase/);
  });

  it("milestone normaliza end", async () => {
    await applyProjectTaskChanges({
      projectId,
      creates: [{ name: "Hito", phaseId: phaseAId, type: "MILESTONE", startDate: "2026-12-05", endDate: "2026-12-10", status: "TODO", clientVisible: true }],
      updates: [],
      deletes: [],
    });
    const h = await prisma.projectTask.findFirst({ where: { projectId, name: "Hito" } });
    expect(h!.startDate.toISOString().slice(0, 10)).toBe("2026-12-05");
    expect(h!.endDate.toISOString().slice(0, 10)).toBe("2026-12-05");
    await prisma.projectTask.delete({ where: { id: h!.id } });
  });

  it("rollback si una inválida", async () => {
    const beforeCount = await prisma.projectTask.count({ where: { projectId } });
    await expect(
      applyProjectTaskChanges({
        projectId,
        creates: [
          { name: "Ok1", phaseId: phaseAId, type: "TASK", startDate: "2026-12-01", endDate: "2026-12-02", status: "TODO", clientVisible: true },
          { name: "", phaseId: phaseAId, type: "TASK", startDate: "2026-12-03", endDate: "2026-12-04", status: "TODO", clientVisible: true },
        ],
        updates: [],
        deletes: [],
      }),
    ).rejects.toThrow();
    const afterCount = await prisma.projectTask.count({ where: { projectId } });
    expect(afterCount).toBe(beforeCount);
  });
});
