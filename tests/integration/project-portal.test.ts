import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createPhase } from "@/server/services/project-phases";
import { createTask } from "@/server/services/project-tasks";
import {
  configureShareAccess,
  activateShareAccess,
  revokeShareAccess,
  changeShareAccessPassword,
  resolveShareGateBySlug,
  authorizeClientAccess,
  getAuthorizedProjectPlan,
} from "@/server/services/project-sharing";
import {
  buildSlug,
  encryptPassword,
  generatePassword,
  signSession,
  verifyPassword,
} from "@/lib/project-access-crypto";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;
const prisma = new PrismaClient({ datasources: { db: { url } } });

let clientId: string;
let projectAId: string;
let projectBId: string;
let slug: string;
let password: string;

async function getLink() {
  return prisma.projectShareLink.findUnique({
    where: { projectId: projectAId },
    select: { slug: true, accessVersion: true, passwordHash: true, passwordEncrypted: true },
  });
}

beforeAll(async () => {
  if (skip) return;
  process.env.PROJECT_SHARE_ENCRYPTION_KEY = "a".repeat(64);
  process.env.PROJECT_SHARE_SESSION_SECRET = "b".repeat(64);

  const client = await prisma.client.create({ data: { name: "Portal Client" } });
  clientId = client.id;
  const pA = await prisma.project.create({ data: { clientId, name: "Sistema de Gestión" } });
  projectAId = pA.id;
  const pB = await prisma.project.create({ data: { clientId, name: "Proyecto B" } });
  projectBId = pB.id;

  const phase = await createPhase({ projectId: projectAId, name: "Fase portal" });
  await createTask({
    projectId: projectAId,
    phaseId: phase.id,
    name: "Visible para cliente",
    startDate: "2026-02-01",
    endDate: "2026-02-10",
    clientVisible: true,
  });
  await createTask({
    projectId: projectAId,
    phaseId: phase.id,
    name: "Oculta",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    clientVisible: false,
  });
});

afterAll(async () => {
  if (skip) {
    await prisma.$disconnect();
    return;
  }
  await prisma.projectShareLink.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } });
  await prisma.projectTask.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } });
  await prisma.projectPhase.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("Acceso del cliente (V1.1)", () => {
  it("slug inexistente no revela existencia", async () => {
    expect(await resolveShareGateBySlug("slug-inexistente")).toBeNull();
    expect(await getAuthorizedProjectPlan("slug-inexistente", null)).toBeNull();
  });

  it("configurar acceso: slug derivado, sin plaintext", async () => {
    const setup = await configureShareAccess(projectAId, "clave-super-segura-123");
    slug = setup.slug;
    password = setup.password;
    expect(slug).toBe(buildSlug("Portal Client", "Sistema de Gestión"));

    const link = await getLink();
    expect(link).not.toBeNull();
    expect(link!.passwordHash).not.toBe(password);
    expect(link!.passwordEncrypted).not.toBe(password);
    expect(link!.accessVersion).toBe(0);
    // la password recuperable está cifrada, no plaintext
    expect(link!.passwordEncrypted).not.toContain(password);
    // y no es el hash de la password cruda
    expect(encryptPassword(password)).not.toBe(link!.passwordEncrypted);
  });

  it("slug es estable aunque cambie el nombre del proyecto", async () => {
    await prisma.project.update({
      where: { id: projectAId },
      data: { name: "Sistema Renombrado" },
    });
    const gate = await resolveShareGateBySlug(slug);
    expect(gate).not.toBeNull();
    expect(gate!.projectName).toBe("Sistema Renombrado");
  });

  it("gate expone información mínima para la pantalla de contraseña", async () => {
    const gate = await resolveShareGateBySlug(slug);
    expect(gate).not.toBeNull();
    expect(gate!.projectId).toBe(projectAId);
    expect(gate!.clientName).toBe("Portal Client");
    expect(gate!.revokedAt).toBeNull();
    expect(gate!.accessVersion).toBe(0);
    expect("password" in gate!).toBe(false);
    expect("passwordHash" in gate!).toBe(false);
  });

  it("sesión válida autoriza y devuelve DTO whitelist", async () => {
    const gate = await resolveShareGateBySlug(slug);
    const session = signSession({
      linkId: gate!.linkId,
      accessVersion: gate!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    const auth = await authorizeClientAccess(slug, session);
    expect(auth).not.toBeNull();
    expect(auth!.projectId).toBe(projectAId);

    const plan = await getAuthorizedProjectPlan(slug, session);
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe(projectAId);
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
    for (const f of forbidden) expect(f in plan!).toBe(false);
  });

  it("sesión inválida / expirada no autoriza", async () => {
    expect(await getAuthorizedProjectPlan(slug, "firma-inexistente")).toBeNull();
    const gate = await resolveShareGateBySlug(slug);
    const expired = signSession({
      linkId: gate!.linkId,
      accessVersion: gate!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });
    expect(await authorizeClientAccess(slug, expired)).toBeNull();
  });

  it("desactivar niega acceso y no revela el gate", async () => {
    await revokeShareAccess(projectAId);
    expect(await resolveShareGateBySlug(slug)).toBeNull();
    const gateBefore = await resolveShareGateBySlug(slug);
    void gateBefore;
    expect(await getAuthorizedProjectPlan(slug, null)).toBeNull();
  });

  it("reactivar conserva slug/password y no revive sesiones antiguas", async () => {
    await activateShareAccess(projectAId);
    const gate = await resolveShareGateBySlug(slug);
    expect(gate).not.toBeNull();
    expect(gate!.accessVersion).toBe(1); // la revocación incrementó la versión

    const link = await getLink();
    expect(link!.slug).toBe(slug);
    expect(await verifyPassword(password, link!.passwordHash)).toBe(true);

    // sesión firmada con la versión vieja (0) es inválida tras revocar/reactivar
    const oldSession = signSession({
      linkId: gate!.linkId,
      accessVersion: 0,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await authorizeClientAccess(slug, oldSession)).toBeNull();

    // sesión nueva con la versión actual funciona
    const newSession = signSession({
      linkId: gate!.linkId,
      accessVersion: gate!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await getAuthorizedProjectPlan(slug, newSession)).not.toBeNull();
  });

  it("cambiar password incrementa accessVersion e invalida la sesión anterior", async () => {
    const gate = await resolveShareGateBySlug(slug);
    const oldVersion = gate!.accessVersion;
    const newPassword = await changeShareAccessPassword(projectAId, "clave-nueva-12345");

    const link = await getLink();
    expect(link!.accessVersion).toBe(oldVersion + 1);
    expect(await verifyPassword(password, link!.passwordHash)).toBe(false);
    expect(await verifyPassword(newPassword, link!.passwordHash)).toBe(true);

    const oldSession = signSession({
      linkId: gate!.linkId,
      accessVersion: oldVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await authorizeClientAccess(slug, oldSession)).toBeNull();
  });

  it("password manual inválida rechazada; configure dos veces rechaza; auto de 16", async () => {
    await expect(configureShareAccess(projectBId, "a1b2c")).rejects.toThrow(/6 caracteres/);
    await expect(configureShareAccess(projectBId, "abcdef")).rejects.toThrow(/letra/);
    await expect(configureShareAccess(projectBId, "123456")).rejects.toThrow(/letra/);
    const auto = await configureShareAccess(projectBId);
    expect(auto.password).toHaveLength(16);
    expect(generatePassword()).toHaveLength(16);
    await expect(configureShareAccess(projectBId)).rejects.toThrow(/ya tiene acceso/);
  });

  it("password manual 6 chars con letra+número válida", async () => {
    const tmpClient = await prisma.client.create({ data: { name: "Tmp Client" } });
    const tmpProject = await prisma.project.create({
      data: { clientId: tmpClient.id, name: "Tmp Project" },
    });
    const setup = await configureShareAccess(tmpProject.id, "abc123");
    expect(setup.password).toBe("abc123");
    await prisma.projectShareLink.deleteMany({ where: { projectId: tmpProject.id } });
    await prisma.project.delete({ where: { id: tmpProject.id } });
    await prisma.client.delete({ where: { id: tmpClient.id } });
  });

  it("sesión de Proyecto A no autoriza Proyecto B", async () => {
    const gateA = await resolveShareGateBySlug(slug);
    const linkB = await prisma.projectShareLink.findUnique({
      where: { projectId: projectBId },
      select: { slug: true, id: true, accessVersion: true },
    });
    const sessionA = signSession({
      linkId: gateA!.linkId,
      accessVersion: gateA!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await authorizeClientAccess(linkB!.slug, sessionA)).toBeNull();
    expect(await getAuthorizedProjectPlan(linkB!.slug, sessionA)).toBeNull();
  });

  it("logout (sin cookie) niega acceso pero re-login funciona", async () => {
    const gate = await resolveShareGateBySlug(slug);
    const session = signSession({
      linkId: gate!.linkId,
      accessVersion: gate!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await authorizeClientAccess(slug, session)).not.toBeNull();
    expect(await authorizeClientAccess(slug, null)).toBeNull();
    const newSession = signSession({
      linkId: gate!.linkId,
      accessVersion: gate!.accessVersion,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    expect(await authorizeClientAccess(slug, newSession)).not.toBeNull();
  });
});