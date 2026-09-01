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
  configureShareAccess,
  getShareAccess,
  revokeShareAccess,
  activateShareAccess,
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

  it("acceso: configurar genera slug/password; revocar/activar conserva slug", async () => {
    process.env.PROJECT_SHARE_ENCRYPTION_KEY = "a".repeat(64);
    process.env.PROJECT_SHARE_SESSION_SECRET = "b".repeat(64);

    const setup = await configureShareAccess(projectAId, "clave-planning-12345");
    expect(setup.slug).toBeTruthy();
    expect(setup.password).toBe("clave-planning-12345");

    const access = await getShareAccess(projectAId);
    expect(access).not.toBeNull();
    expect(access!.slug).toBe(setup.slug);
    expect(access!.revokedAt).toBeNull();

    await revokeShareAccess(projectAId);
    const revoked = await getShareAccess(projectAId);
    expect(revoked!.revokedAt).not.toBeNull();
    expect(revoked!.slug).toBe(setup.slug);
    expect(revoked!.accessVersion).toBeGreaterThan(0);

    await activateShareAccess(projectAId);
    const active = await getShareAccess(projectAId);
    expect(active!.revokedAt).toBeNull();
    expect(active!.slug).toBe(setup.slug);
  });
});
