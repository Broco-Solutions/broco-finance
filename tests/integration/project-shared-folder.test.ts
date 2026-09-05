import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  configureShareAccess,
  revokeShareAccess,
  activateShareAccess,
  setClientSharedFolder,
  clearClientSharedFolder,
  resolveShareGateBySlug,
  getAuthorizedProjectPlan,
} from "@/server/services/project-sharing";
import { signSession } from "@/lib/project-access-crypto";
import { SHARED_FOLDER_LABEL_DEFAULT } from "@/lib/shared-folder-url";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientId: string;
let projectAId: string;
let projectBId: string;
let slug: string;

const DRIVE_URL =
  "https://drive.google.com/drive/folders/1NskSnUyMgMOkbVMb9xJ6oNT9xWi-jrGP?usp=drive_link";

async function folderOf(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { clientSharedFolderUrl: true, clientSharedFolderLabel: true },
  });
}

beforeAll(async () => {
  if (skip) return;
  process.env.PROJECT_SHARE_ENCRYPTION_KEY = "a".repeat(64);
  process.env.PROJECT_SHARE_SESSION_SECRET = "b".repeat(64);

  const client = await prisma.client.create({ data: { name: "Folder Client" } });
  clientId = client.id;
  const pA = await prisma.project.create({ data: { clientId, name: "Folder Project A" } });
  projectAId = pA.id;
  const pB = await prisma.project.create({ data: { clientId, name: "Folder Project B" } });
  projectBId = pB.id;
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  await prisma.projectShareLink.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("Carpeta compartida del proyecto", () => {
  it("guarda URL y etiqueta en un proyecto", async () => {
    const result = await setClientSharedFolder(projectAId, DRIVE_URL, "Archivos compartidos del proyecto");
    expect(result.url).toBe(DRIVE_URL);
    expect(result.label).toBe("Archivos compartidos del proyecto");

    const folder = await folderOf(projectAId);
    expect(folder).toEqual({
      clientSharedFolderUrl: DRIVE_URL,
      clientSharedFolderLabel: "Archivos compartidos del proyecto",
    });
  });

  it("usa la etiqueta predeterminada cuando el texto queda vacío", async () => {
    await setClientSharedFolder(projectBId, DRIVE_URL, "   ");
    const folder = await folderOf(projectBId);
    expect(folder!.clientSharedFolderLabel).toBe(SHARED_FOLDER_LABEL_DEFAULT);
  });

  it("edita la configuración existente", async () => {
    await setClientSharedFolder(projectAId, "https://www.dropbox.com/scl/fo/abc/folder?dl=0", "Nueva etiqueta");
    const folder = await folderOf(projectAId);
    expect(folder).toEqual({
      clientSharedFolderUrl: "https://www.dropbox.com/scl/fo/abc/folder?dl=0",
      clientSharedFolderLabel: "Nueva etiqueta",
    });
  });

  it("no permite guardar una etiqueta sin URL", async () => {
    await expect(setClientSharedFolder(projectAId, "", "Solo texto")).rejects.toThrow(
      /obligatorio/,
    );
    await expect(setClientSharedFolder(projectAId, null, "Solo texto")).rejects.toThrow(
      /obligatorio/,
    );
  });

  it("rechaza URLs inválidas", async () => {
    await expect(setClientSharedFolder(projectAId, "http://example.com/f")).rejects.toThrow(/HTTPS/);
    await expect(setClientSharedFolder(projectAId, "javascript:alert(1)")).rejects.toThrow(/HTTPS/);
    await expect(setClientSharedFolder(projectAId, "carpeta-relativa")).rejects.toThrow(/HTTPS/);
    await expect(setClientSharedFolder(projectAId, "https://user:pass@example.com/f")).rejects.toThrow(/HTTPS/);
  });

  it("no permite modificar otro proyecto", async () => {
    await setClientSharedFolder(projectAId, DRIVE_URL, "Texto A");
    const folderB = await folderOf(projectBId);
    expect(folderB!.clientSharedFolderUrl).toBe(DRIVE_URL);
    expect(folderB!.clientSharedFolderLabel).toBe(SHARED_FOLDER_LABEL_DEFAULT);
  });

  it("revocar y reactivar el portal no elimina la configuración", async () => {
    await setClientSharedFolder(projectAId, DRIVE_URL, "Persistente");
    const setup = await configureShareAccess(projectAId, "clave-segura-123");
    slug = setup.slug;

    await revokeShareAccess(projectAId);
    await activateShareAccess(projectAId);

    const folder = await folderOf(projectAId);
    expect(folder).toEqual({
      clientSharedFolderUrl: DRIVE_URL,
      clientSharedFolderLabel: "Persistente",
    });
  });

  it("DTO autorizado incluye solo los dos campos nuevos y excluye datos financieros/admin", async () => {
    const gate = await resolveShareGateBySlug(slug);
    const session = signSession({
      linkId: gate!.linkId,
      accessVersion: gate!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });

    const plan = await getAuthorizedProjectPlan(slug, session);
    expect(plan).not.toBeNull();
    expect(plan!.clientSharedFolderUrl).toBe(DRIVE_URL);
    expect(plan!.clientSharedFolderLabel).toBe("Persistente");

    const forbidden = [
      "incomes",
      "expenses",
      "notes",
      "oneTimeOriginalAmount",
      "oneTimeCurrency",
      "oneTimeExchangeRate",
      "oneTimeAmountUsd",
      "monthlyRecurringOriginalAmount",
      "monthlyRecurringCurrency",
      "monthlyRecurringExchangeRate",
      "monthlyRecurringAmountUsd",
      "clientId",
      "isActive",
    ];
    for (const f of forbidden) expect(f in plan!).toBe(false);
  });

  it("elimina URL y etiqueta dejando estado consistente", async () => {
    await clearClientSharedFolder(projectAId);
    const folder = await folderOf(projectAId);
    expect(folder).toEqual({
      clientSharedFolderUrl: null,
      clientSharedFolderLabel: null,
    });
  });
});
