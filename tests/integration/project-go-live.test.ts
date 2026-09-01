import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@/server/services/clients";
import { createProject, getProject } from "@/server/services/projects";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientId: string;
let projectId: string;

beforeAll(async () => {
  if (skip) return;
  const client = await prisma.client.create({ data: { name: `golive-client-${Date.now()}` } });
  clientId = client.id;
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
  if (clientId) await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("goLiveDate en Project", () => {
  it("persiste y recupera goLiveDate", async () => {
    const project = await createProject({
      clientId,
      name: `golive-proj-${Date.now()}`,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      goLiveDate: "2026-06-15",
    });
    projectId = project.id;

    const read = await getProject(project.id);
    expect(read.goLiveDate).not.toBeNull();
    expect(new Date(read.goLiveDate as Date).toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("goLiveDate opcional puede ser null", async () => {
    const project = await createProject({
      clientId,
      name: `golive-proj-null-${Date.now()}`,
    });
    await prisma.project.delete({ where: { id: project.id } });
    expect(project.goLiveDate).toBeNull();
  });
});
