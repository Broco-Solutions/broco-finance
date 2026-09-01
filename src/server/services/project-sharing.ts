import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";

export type ProjectShareLinkRecord = {
  id: string;
  projectId: string;
  tokenHash: string;
  createdAt: Date;
  revokedAt: Date | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function generateShareLink(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new Error("Proyecto no encontrado.");

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await prisma.projectShareLink.upsert({
    where: { projectId },
    create: { projectId, tokenHash },
    update: { tokenHash, revokedAt: null },
  });
  revalidatePath(`/projects/${projectId}`);
  return token;
}

export async function regenerateShareLink(projectId: string): Promise<string> {
  return generateShareLink(projectId);
}

export async function revokeShareLink(projectId: string): Promise<boolean> {
  const link = await prisma.projectShareLink.findUnique({ where: { projectId } });
  if (!link) return false;
  await prisma.projectShareLink.update({
    where: { projectId },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/projects/${projectId}`);
  return true;
}

export async function getShareLink(projectId: string): Promise<ProjectShareLinkRecord | null> {
  return prisma.projectShareLink.findUnique({ where: { projectId } });
}

export async function resolveShareToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const link = await prisma.projectShareLink.findUnique({ where: { tokenHash } });
  if (!link || link.revokedAt) return null;
  return link.projectId;
}

export async function getSharedProjectPlan(token: string) {
  const projectId = await resolveShareToken(token);
  if (!projectId) return null;

  return prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      goLiveDate: true,
      updatedAt: true,
      client: { select: { name: true } },
      phases: {
        select: { id: true, name: true, position: true },
        orderBy: { position: "asc" },
      },
      tasks: {
        select: {
          id: true,
          phaseId: true,
          name: true,
          description: true,
          type: true,
          startDate: true,
          endDate: true,
          status: true,
          position: true,
        },
        where: { clientVisible: true },
        orderBy: { position: "asc" },
      },
    },
  });
}
