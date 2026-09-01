import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createPhase,
  updatePhase,
  deletePhase,
  listPhases,
} from "@/server/services/project-phases";
import {
  createTask,
  listTasks,
  setTaskStatus,
  setTaskPhase,
  setTaskClientVisible,
} from "@/server/services/project-tasks";
import {
  generateShareLink,
  regenerateShareLink,
  revokeShareLink,
  getShareLink,
  resolveShareToken,
  getSharedProjectPlan,
} from "@/server/services/project-sharing";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientAId: string;
let clientBId: string;
let projectAId: string;
let projectBId: string;

beforeAll(async () => {
  if (skip) return;
  const cA = await prisma.client.create({ data: { name: `int-pa-${Date.now()}` } });
  clientAId = cA.id;
  const cB = await prisma.client.create({ data: { name: `int-pb-${Date.now()}` } });
  clientBId = cB.id;
  const pA = await prisma.project.create({
    data: { clientId: clientAId, name: `int-proj-a-${Date.now()}` },
  });
  projectAId = pA.id;
  const pB = await prisma.project.create({
    data: { clientId: clientBId, name: `int-proj-b-${Date.now()}` },
  });
  projectBId = pB.id;
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  await prisma.projectShareLink.deleteMany({
    where: { projectId: { in: [projectAId, projectBId] } },
  });
  await prisma.projectTask.deleteMany({
    where: { projectId: { in: [projectAId, projectBId] } },
  });
  await prisma.projectPhase.deleteMany({
    where: { projectId: { in: [projectAId, projectBId] } },
  });
  await prisma.project.deleteMany({
    where: { id: { in: [projectAId, projectBId] } },
  });
  await prisma.client.deleteMany({
    where: { id: { in: [clientAId, clientBId] } },
  });
  await prisma.$disconnect();
});

describe.skipIf(skip)("Project Planning — integración", () => {
  it("crea, lista y edita fases ordenadas por position", async () => {
    const p1 = await createPhase({ projectId: projectAId, name: "Fase 1" });
    const p2 = await createPhase({ projectId: projectAId, name: "Fase 2" });
    const phases = await listPhases(projectAId);
    expect(phases).toHaveLength(2);
    expect(phases[0].position).toBeLessThanOrEqual(phases[1].position);

    const edited = await updatePhase(p1.id, { name: "Fase 1 editada" });
    expect(edited.name).toBe("Fase 1 editada");
  });

  it("eliminar fase NO elimina tareas; quedan con phaseId null (SetNull)", async () => {
    const phase = await createPhase({ projectId: projectAId, name: "Fase con tareas" });
    const task = await createTask({
      projectId: projectAId,
      phaseId: phase.id,
      name: "Tarea en fase",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    await deletePhase(phase.id);
    const after = await prisma.projectTask.findUnique({ where: { id: task.id } });
    expect(after).not.toBeNull();
    expect(after!.phaseId).toBeNull();
  });

  it("rechaza asociar tarea a fase de otro proyecto", async () => {
    const phaseB = await createPhase({ projectId: projectBId, name: "Fase B" });
    await expect(
      createTask({
        projectId: projectAId,
        phaseId: phaseB.id,
        name: "X",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      }),
    ).rejects.toThrow(/no pertenece/);

    const taskA = await createTask({
      projectId: projectAId,
      name: "TA",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    await expect(setTaskPhase(taskA.id, phaseB.id)).rejects.toThrow(/no pertenece/);
  });

  it("cambia status, fase y clientVisible", async () => {
    const phase = await createPhase({ projectId: projectAId, name: "Ph status" });
    const t = await createTask({
      projectId: projectAId,
      name: "T status",
      startDate: "2026-02-01",
      endDate: "2026-02-02",
    });
    const s = await setTaskStatus(t.id, "DONE");
    expect(s.status).toBe("DONE");
    const sp = await setTaskPhase(t.id, phase.id);
    expect(sp.phaseId).toBe(phase.id);
    const cv = await setTaskClientVisible(t.id, false);
    expect(cv.clientVisible).toBe(false);
  });

  it("share link: token raw nunca se persiste; regenerar cambia hash; revocar invalida", async () => {
    const token = await generateShareLink(projectAId);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const link = await getShareLink(projectAId);
    expect(link).not.toBeNull();
    expect(link!.tokenHash).not.toBe(token);
    expect(link!.tokenHash).toHaveLength(64);

    const token2 = await regenerateShareLink(projectAId);
    const link2 = await getShareLink(projectAId);
    expect(link2!.tokenHash).not.toBe(link!.tokenHash);
    expect(link2!.revokedAt).toBeNull();

    expect(await resolveShareToken(token2)).toBe(projectAId);

    expect(await revokeShareLink(projectAId)).toBe(true);
    expect(await resolveShareToken(token2)).toBeNull();
    expect(await resolveShareToken("token-inexistente")).toBeNull();
  });

  it("getSharedProjectPlan filtra clientVisible y no expone campos financieros", async () => {
    const planToken = await generateShareLink(projectAId);
    await createTask({
      projectId: projectAId,
      name: "Visible",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      clientVisible: true,
    });
    await createTask({
      projectId: projectAId,
      name: "Oculta",
      startDate: "2026-01-03",
      endDate: "2026-01-04",
      clientVisible: false,
    });

    const plan = await getSharedProjectPlan(planToken);
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe(projectAId);
    expect(plan!.client.name).toBeTruthy();

    const names = plan!.tasks.map((t) => t.name);
    expect(names).toContain("Visible");
    expect(names).not.toContain("Oculta");

    const forbidden = [
      "incomes",
      "expenses",
      "oneTimeOriginalAmount",
      "oneTimeCurrency",
      "oneTimeExchangeRate",
      "oneTimeAmountUsd",
      "monthlyRecurringOriginalAmount",
      "monthlyRecurringCurrency",
      "monthlyRecurringExchangeRate",
      "monthlyRecurringAmountUsd",
      "notes",
    ];
    for (const f of forbidden) {
      expect(f in plan!).toBe(false);
    }

    expect(Object.keys(plan!)).toEqual(
      expect.arrayContaining(["id", "name", "startDate", "endDate", "goLiveDate", "updatedAt", "client", "phases", "tasks"]),
    );

    expect(await getSharedProjectPlan("token-malo")).toBeNull();
  });
});
