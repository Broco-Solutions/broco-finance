import "server-only";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import {
  buildSlug,
  decryptPassword,
  encryptPassword,
  generatePassword,
  hashPassword,
  isValidManualPassword,
  verifyPassword,
  verifySession,
} from "@/lib/project-access-crypto";
import {
  assertValidSharedFolderUrl,
  normalizeSharedFolderLabel,
} from "@/lib/shared-folder-url";

// ---------------------------------------------------------------------------
// Shared access (V1.1: slug + password + session)
// ---------------------------------------------------------------------------

export type ShareAccess = {
  slug: string;
  revokedAt: Date | null;
  accessVersion: number;
};

export type ShareGate = {
  linkId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  revokedAt: Date | null;
  accessVersion: number;
};

export type ShareAuthorization = {
  linkId: string;
  projectId: string;
};

export type ShareAccessSetup = {
  slug: string;
  password: string;
};

async function assertProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new Error("Proyecto no encontrado.");
}

function resolveManualPassword(password: string | undefined): { password: string; auto: boolean } {
  if (password !== undefined && password.trim() !== "") {
    const trimmed = password.trim();
    if (!isValidManualPassword(trimmed)) {
      throw new Error(
        "La contraseña debe tener al menos 6 caracteres, con al menos una letra y un número.",
      );
    }
    return { password: trimmed, auto: false };
  }
  return { password: generatePassword(), auto: true };
}

async function uniqueSlugForProject(clientName: string, projectName: string): Promise<string> {
  const base = buildSlug(clientName, projectName);
  const exists = async (s: string) => {
    const found = await prisma.projectShareLink.findUnique({
      where: { slug: s },
      select: { id: true },
    });
    return found !== null;
  };
  if (!(await exists(base))) return base;
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("No se pudo generar un slug único.");
}

export async function configureShareAccess(
  projectId: string,
  password?: string,
): Promise<ShareAccessSetup> {
  await assertProject(projectId);
  const existing = await prisma.projectShareLink.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (existing) throw new Error("El proyecto ya tiene acceso configurado.");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, client: { select: { name: true } } },
  });
  if (!project) throw new Error("Proyecto no encontrado.");

  const { password: resolved, auto } = resolveManualPassword(password);
  void auto;
  const slug = await uniqueSlugForProject(project.client.name, project.name);
  const passwordHash = await hashPassword(resolved);
  const passwordEncrypted = encryptPassword(resolved);

  await prisma.projectShareLink.create({
    data: { projectId, slug, passwordHash, passwordEncrypted, accessVersion: 0 },
  });
  revalidatePath(`/projects/${projectId}`);
  return { slug, password: resolved };
}

export async function getShareAccess(projectId: string): Promise<ShareAccess | null> {
  const link = await prisma.projectShareLink.findUnique({
    where: { projectId },
    select: { slug: true, revokedAt: true, accessVersion: true },
  });
  return link;
}

export async function revealPassword(projectId: string): Promise<string> {
  const link = await prisma.projectShareLink.findUnique({
    where: { projectId },
    select: { passwordEncrypted: true },
  });
  if (!link) throw new Error("El proyecto no tiene acceso configurado.");
  return decryptPassword(link.passwordEncrypted);
}

export async function changeShareAccessPassword(
  projectId: string,
  password?: string,
): Promise<string> {
  const link = await prisma.projectShareLink.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!link) throw new Error("El proyecto no tiene acceso configurado.");

  const { password: resolved } = resolveManualPassword(password);
  const passwordHash = await hashPassword(resolved);
  const passwordEncrypted = encryptPassword(resolved);

  await prisma.projectShareLink.update({
    where: { id: link.id },
    data: { passwordHash, passwordEncrypted, accessVersion: { increment: 1 } },
  });
  revalidatePath(`/projects/${projectId}`);
  return resolved;
}

export async function revokeShareAccess(projectId: string): Promise<void> {
  const link = await prisma.projectShareLink.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!link) throw new Error("El proyecto no tiene acceso configurado.");
  await prisma.projectShareLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date(), accessVersion: { increment: 1 } },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function activateShareAccess(projectId: string): Promise<void> {
  const link = await prisma.projectShareLink.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!link) throw new Error("El proyecto no tiene acceso configurado.");
  await prisma.projectShareLink.update({
    where: { id: link.id },
    data: { revokedAt: null },
  });
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Shared folder (per-project external link, independent of portal access)
// ---------------------------------------------------------------------------

export async function setClientSharedFolder(
  projectId: string,
  rawUrl: string | null | undefined,
  rawLabel?: string | null,
): Promise<{ url: string; label: string }> {
  await assertProject(projectId);
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error("El enlace es obligatorio para guardar la carpeta compartida.");
  }
  const url = assertValidSharedFolderUrl(rawUrl);
  const label = normalizeSharedFolderLabel(rawLabel);
  await prisma.project.update({
    where: { id: projectId },
    data: { clientSharedFolderUrl: url, clientSharedFolderLabel: label },
  });
  revalidatePath(`/projects/${projectId}`);
  return { url, label };
}

export async function clearClientSharedFolder(projectId: string): Promise<void> {
  await assertProject(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: { clientSharedFolderUrl: null, clientSharedFolderLabel: null },
  });
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Client access: gate → authorization → authorized DTO
// ---------------------------------------------------------------------------

export async function resolveShareGateBySlug(slug: string): Promise<ShareGate | null> {
  const link = await prisma.projectShareLink.findUnique({
    where: { slug },
    select: {
      id: true,
      projectId: true,
      revokedAt: true,
      accessVersion: true,
      project: {
        select: { name: true, client: { select: { name: true } } },
      },
    },
  });
  if (!link || link.revokedAt) return null;
  return {
    linkId: link.id,
    projectId: link.projectId,
    projectName: link.project.name,
    clientName: link.project.client.name,
    revokedAt: link.revokedAt,
    accessVersion: link.accessVersion,
  };
}

export async function authorizeClientAccess(
  slug: string,
  sessionPayload: string | null | undefined,
  now?: number,
): Promise<ShareAuthorization | null> {
  const parsed = verifySession(sessionPayload, now);
  if (!parsed) return null;

  const link = await prisma.projectShareLink.findUnique({
    where: { id: parsed.linkId },
    select: { id: true, projectId: true, slug: true, revokedAt: true, accessVersion: true },
  });
  if (!link || link.revokedAt) return null;
  if (link.slug !== slug) return null;
  if (link.accessVersion !== parsed.accessVersion) return null;

  return { linkId: link.id, projectId: link.projectId };
}

const PORTAL_WHITELIST_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  goLiveDate: true,
  updatedAt: true,
  clientSharedFolderUrl: true,
  clientSharedFolderLabel: true,
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
} as const;

export async function getAuthorizedProjectPlan(
  slug: string,
  sessionPayload: string | null | undefined,
  now?: number,
) {
  const authorization = await authorizeClientAccess(slug, sessionPayload, now);
  if (!authorization) return null;

  return prisma.project.findUnique({
    where: { id: authorization.projectId },
    select: PORTAL_WHITELIST_SELECT,
  });
}

