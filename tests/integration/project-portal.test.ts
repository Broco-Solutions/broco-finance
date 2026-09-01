import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/server/services/clients";
import { createProject } from "@/server/services/projects";
import { createPhase } from "@/server/services/project-phases";
import { createTask } from "@/server/services/project-tasks";
import {
  generateShareLink,
  revokeShareLink,
  getSharedProjectPlan,
} from "@/server/services/project-sharing";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientId: string;
let projectId: string;

beforeAll(async () => {
  if (skip) return;
  const client = await prisma.client.create({ data: { name: `portal-client-${Date.now()}` } });
  clientId = client.id;
  const project = await prisma.project.create({
    data: { clientId, name: `portal-proj-${Date.now()}` },
  });
  projectId = project.id;
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  await prisma.projectShareLink.deleteMany({ where: { projectId } });
  await prisma.projectTask.deleteMany({ where: { projectId } });
  await prisma.projectPhase.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("Portal público del cliente", () => {
  it("token inválido retorna null (no revela existencia)", async () => {
    expect(await getSharedProjectPlan("token-inexistente")).toBeNull();
  });

  it("token revocado retorna null", async () => {
    const token = await generateShareLink(projectId);
    await revokeShareLink(projectId);
    expect(await getSharedProjectPlan(token)).toBeNull();
  });

  it("solo expone tareas clientVisible=true y ningún dato financiero", async () => {
    const phase = await createPhase({ projectId, name: "Fase portal" });
    await createTask({
      projectId,
      phaseId: phase.id,
      name: "Visible para cliente",
      startDate: "2026-02-01",
      endDate: "2026-02-10",
      clientVisible: true,
    });
    await createTask({
      projectId,
      phaseId: phase.id,
      name: "Oculta",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      clientVisible: false,
    });

    const token = await generateShareLink(projectId);
    const plan = await getSharedProjectPlan(token);
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe(projectId);
    expect(plan!.client.name).toBeTruthy();

    const names = plan!.tasks.map((t) => t.name);
    expect(names).toContain("Visible para cliente");
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
  });
});
