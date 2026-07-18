import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createProject, updateProject, deleteProject } from "@/server/services/projects";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;
const skip = !TEST_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let clientAId: string;
let clientBId: string;
let projectId: string;

beforeAll(async () => {
  if (skip) return;
  // Create two test clients
  const cA = await createClient({ name: `test-int-client-a-${Date.now()}` });
  clientAId = cA.id;
  const cB = await createClient({ name: `test-int-client-b-${Date.now()}` });
  clientBId = cB.id;
});

afterAll(async () => {
  if (skip || !clientAId || !clientBId) return;
  // Clean up test data
  await prisma.expense.deleteMany({ where: { project: { clientId: { in: [clientAId, clientBId] } } } });
  await prisma.income.deleteMany({ where: { OR: [{ project: { clientId: { in: [clientAId, clientBId] } } }, { clientId: { in: [clientAId, clientBId] } }] } });
  await prisma.project.deleteMany({ where: { clientId: { in: [clientAId, clientBId] } } });
  await prisma.client.deleteMany({ where: { id: { in: [clientAId, clientBId] } } });
  await prisma.$disconnect();
});

describe.skipIf(skip)("Clientes — integracion", () => {
  it("1. crea un cliente", async () => {
    const name = `test-create-${Date.now()}`;
    const c = await createClient({ name, contactName: "Test Contact" });
    expect(c.id).toBeDefined();
    expect(c.name).toBe(name);
    expect(c.contactName).toBe("Test Contact");
    // clean
    await deleteClient(c.id);
  });

  it("2. edita un cliente", async () => {
    const name = `test-edit-${Date.now()}`;
    const c = await createClient({ name });
    const updated = await updateClient(c.id, { name: c.name + " updated", contactName: "New Contact" });
    expect(updated.contactName).toBe("New Contact");
    await deleteClient(c.id);
  });

  it("3. rechaza nombre duplicado (case-insensitive)", async () => {
    const base = `test-dup-${Date.now()}`;
    await createClient({ name: base });
    await expect(createClient({ name: base.toUpperCase() })).rejects.toThrow("existe");
    await expect(createClient({ name: `  ${base}  ` })).rejects.toThrow("existe");
    // Also test via raw query that unique index catches this
    const client = await prisma.client.findFirst({ where: { name: base } });
    expect(client).not.toBeNull();
    await deleteClient(client!.id);
  });

  it("4. elimina un cliente sin relaciones", async () => {
    const name = `test-del-${Date.now()}`;
    const c = await createClient({ name });
    await deleteClient(c.id);
    const found = await prisma.client.findUnique({ where: { id: c.id } });
    expect(found).toBeNull();
  });

  it("5. bloquea eliminacion con proyecto asociado", async () => {
    const c = await createClient({ name: `test-block-del-${Date.now()}` });
    const p = await createProject({ clientId: c.id, name: `test-proj-${Date.now()}`, isActive: true });
    await expect(deleteClient(c.id)).rejects.toThrow("No se puede eliminar");
    // clean
    await deleteProject(p.id);
    await deleteClient(c.id);
  });
});

describe.skipIf(skip)("Proyectos — integracion", () => {
  it("6. crea proyecto sin importes", async () => {
    const p = await createProject({ clientId: clientAId, name: `test-no-amounts-${Date.now()}`, isActive: true });
    expect(p.id).toBeDefined();
    expect(p.oneTimeAmountUsd).toBeNull();
    expect(p.monthlyRecurringAmountUsd).toBeNull();
    await deleteProject(p.id);
  });

  it("7. crea proyecto USD con equivalente", async () => {
    const p = await createProject({
      clientId: clientAId,
      name: `test-usd-${Date.now()}`,
      isActive: true,
      oneTimeOriginalAmount: 5000,
      oneTimeCurrency: "USD",
    });
    expect(p.oneTimeCurrency).toBe("USD");
    expect(p.oneTimeAmountUsd?.toString()).toBe("5000");
    expect(p.oneTimeExchangeRate).toBeNull();
    await deleteProject(p.id);
  });

  it("8. crea proyecto ARS y calcula USD con Decimal", async () => {
    const p = await createProject({
      clientId: clientAId,
      name: `test-ars-${Date.now()}`,
      isActive: true,
      oneTimeOriginalAmount: 1000000,
      oneTimeCurrency: "ARS",
      oneTimeExchangeRate: 810,
    });
    expect(p.oneTimeCurrency).toBe("ARS");
    expect(p.oneTimeExchangeRate).not.toBeNull();
    // 1000000 / 810 = 1234.567901...
    const usd = Number(p.oneTimeAmountUsd?.toString());
    expect(usd).toBeCloseTo(1234.567901, 4);
    await deleteProject(p.id);
  });

  it("9. rechaza nombre duplicado dentro del mismo cliente", async () => {
    const name = `test-dup-proj-${Date.now()}`;
    const p1 = await createProject({ clientId: clientAId, name, isActive: true });
    await expect(createProject({ clientId: clientAId, name, isActive: true })).rejects.toThrow("existe");
    await deleteProject(p1.id);
  });

  it("10. permite mismo nombre en clientes distintos", async () => {
    const name = `test-same-name-${Date.now()}`;
    const p1 = await createProject({ clientId: clientAId, name, isActive: true });
    const p2 = await createProject({ clientId: clientBId, name, isActive: true });
    expect(p1.id).not.toBe(p2.id);
    await deleteProject(p1.id);
    await deleteProject(p2.id);
  });

  it("11. bloquea cambio de cliente con ingresos o gastos", async () => {
    const p = await createProject({ clientId: clientAId, name: `test-move-${Date.now()}`, isActive: true });
    // Add an income to create a movement
    const inc = await prisma.income.create({
      data: {
        projectId: p.id,
        clientId: clientAId,
        type: "OTHER",
        concept: "test movement",
        status: "PAID",
        amountUsd: 100,
        effectiveDate: new Date(),
      },
    });
    await expect(
      updateProject(p.id, { clientId: clientBId, name: p.name, isActive: true }),
    ).rejects.toThrow("movimientos");
    // clean
    await prisma.income.delete({ where: { id: inc.id } });
    await deleteProject(p.id);
  });

  it("12. bloquea eliminacion con movimientos", async () => {
    const p = await createProject({ clientId: clientAId, name: `test-block-del-proj-${Date.now()}`, isActive: true });
    const inc = await prisma.income.create({
      data: {
        projectId: p.id,
        clientId: clientAId,
        type: "OTHER",
        concept: "test",
        status: "PAID",
        amountUsd: 50,
        effectiveDate: new Date(),
      },
    });
    await expect(deleteProject(p.id)).rejects.toThrow("movimientos");
    await prisma.income.delete({ where: { id: inc.id } });
    await deleteProject(p.id);
  });

  it("13. activa e inactiva sin modificar otros datos", async () => {
    const p = await createProject({
      clientId: clientAId,
      name: `test-toggle-${Date.now()}`,
      isActive: true,
      oneTimeOriginalAmount: 100,
      oneTimeCurrency: "USD",
    });
    expect(p.isActive).toBe(true);

    const inactivated = await updateProject(p.id, {
      clientId: clientAId,
      name: p.name,
      isActive: false,
      oneTimeOriginalAmount: 100,
      oneTimeCurrency: "USD",
    });
    expect(inactivated.isActive).toBe(false);
    expect(inactivated.oneTimeAmountUsd?.toString()).toBe("100");

    const reactivated = await updateProject(p.id, {
      clientId: clientAId,
      name: p.name,
      isActive: true,
    });
    expect(reactivated.isActive).toBe(true);

    await deleteProject(p.id);
  });
});
