import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createIncome, updateIncome, deleteIncome, getIncome } from "@/server/services/incomes";
import { createIncomeBatch } from "@/app/incomes/actions";
import { createClient } from "@/server/services/clients";
import { createProject } from "@/server/services/projects";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;
const skip = !TEST_DB_URL;

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

let clientId: string;
let projectId: string;
let testIds: string[] = [];

beforeAll(async () => {
  if (skip) return;
  const c = await createClient({ name: `test-inc-client-${Date.now()}` });
  clientId = c.id;
  const p = await createProject({ clientId, name: `test-inc-proj-${Date.now()}`, isActive: true });
  projectId = p.id;
});

afterAll(async () => {
  if (skip) return;
  for (const id of testIds) {
    try { await deleteIncome(id); } catch {}
  }
  try { await prisma.project.deleteMany({ where: { clientId } }); } catch {}
  try { await prisma.client.deleteMany({ where: { id: clientId } }); } catch {}
  await prisma.$disconnect();
});

function track(id: string) { testIds.push(id); }

describe.skipIf(skip)("Ingresos - integracion", () => {
  it("1. crea DEVELOPMENT con proyecto y cliente derivado", async () => {
    const inc = await createIncome({
      type: "DEVELOPMENT", concept: "Test Dev", status: "PAID",
      projectId, amountUsd: 500, effectiveDate: "2026-01-15",
    });
    track(inc.id);
    expect(inc.clientId).toBe(clientId);
    expect(inc.projectId).toBe(projectId);
  });

  it("2. crea OTHER sin cliente ni proyecto", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Test Other Solo", status: "PAID",
      amountUsd: 100, effectiveDate: "2026-01-15",
    });
    track(inc.id);
    expect(inc.clientId).toBeNull();
    expect(inc.projectId).toBeNull();
  });

  it("3. crea OTHER con cliente directo", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Test Other Client", status: "PAID",
      amountUsd: 200, effectiveDate: "2026-01-15", clientId,
    });
    track(inc.id);
    expect(inc.clientId).toBe(clientId);
  });

  it("4. crea OTHER con proyecto (cliente derivado)", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Test Other Proj", status: "PAID",
      amountUsd: 300, effectiveDate: "2026-01-15", projectId,
    });
    track(inc.id);
    expect(inc.clientId).toBe(clientId);
    expect(inc.projectId).toBe(projectId);
  });

  it("5. crea ingreso USD", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "USD only", status: "PAID",
      amountUsd: 1000, effectiveDate: "2026-01-15",
    });
    track(inc.id);
    expect(Number(inc.amountUsd)).toBe(1000);
    expect(inc.amountArs).toBeNull();
    expect(inc.exchangeRate).toBeNull();
  });

  it("6. crea ingreso ARS y verifica USD calculado", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "ARS calc", status: "PAID",
      amountArs: 100000, exchangeRate: 800, effectiveDate: "2026-01-15",
    });
    track(inc.id);
    expect(Number(inc.amountArs)).toBe(100000);
    expect(Number(inc.amountUsd)).toBeCloseTo(125, 4);
  });

  it("7. crea pendiente", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Pending test", status: "PENDING",
      amountUsd: 50, dueDate: "2026-12-01",
    });
    track(inc.id);
    expect(inc.status).toBe("PENDING");
    expect(inc.dueDate).not.toBeNull();
    expect(inc.effectiveDate).toBeNull();
  });

  it("8. marca pendiente como cobrado conservando dueDate", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "To Pay", status: "PENDING",
      amountUsd: 75, dueDate: "2026-06-01",
    });
    track(inc.id);
    const paid = await updateIncome(inc.id, {
      type: "OTHER", concept: inc.concept, status: "PAID",
      amountUsd: 80, effectiveDate: "2026-05-15", dueDate: inc.dueDate?.toISOString().slice(0, 10) ?? null,
    });
    expect(paid.status).toBe("PAID");
    expect(paid.effectiveDate).not.toBeNull();
    expect(paid.dueDate).not.toBeNull();
    expect(Number(paid.amountUsd)).toBe(80);
  });

  it("9. edita ingreso cobrado", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Editable", status: "PAID",
      amountUsd: 100, effectiveDate: "2026-01-01",
    });
    track(inc.id);
    const updated = await updateIncome(inc.id, {
      type: "OTHER", concept: "Edited", status: "PAID",
      amountUsd: 200, effectiveDate: "2026-02-01",
    });
    expect(updated.concept).toBe("Edited");
    expect(Number(updated.amountUsd)).toBe(200);
  });

  it("10. elimina ingreso pendiente", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "To Delete", status: "PENDING",
      amountUsd: 10, dueDate: "2026-12-01",
    });
    await deleteIncome(inc.id);
    await expect(getIncome(inc.id)).rejects.toThrow("no encontrado");
  });

  it("11. elimina ingreso cobrado", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Paid Delete", status: "PAID",
      amountUsd: 10, effectiveDate: "2026-01-01",
    });
    await deleteIncome(inc.id);
    await expect(getIncome(inc.id)).rejects.toThrow("no encontrado");
  });

  it("12. crea lote de ingresos via batch", async () => {
    const result = await createIncomeBatch([
      { type: "DEVELOPMENT", projectId, concept: "Lote", status: "PENDING", amountUsd: 100, dueDate: "2026-02-01" },
      { type: "DEVELOPMENT", projectId, concept: "Lote", status: "PENDING", amountUsd: 100, dueDate: "2026-03-01" },
      { type: "DEVELOPMENT", projectId, concept: "Lote", status: "PENDING", amountUsd: 100, dueDate: "2026-04-01" },
    ]);
    expect(result.success).toBe(true);
    const incomes = await prisma.income.findMany({ where: { concept: "Lote" } });
    expect(incomes.length).toBe(3);
    incomes.forEach((i) => { track(i.id); expect(i.status).toBe("PENDING"); });
  });

  it("13. calculo OVERDUE sin persistir", async () => {
    const inc = await createIncome({
      type: "OTHER", concept: "Old pending", status: "PENDING",
      amountUsd: 5, dueDate: "2020-01-01",
    });
    track(inc.id);
    const fetched = await getIncome(inc.id);
    expect(fetched.status).toBe("PENDING"); // never persisted as OVERDUE
    // OVERDUE is derived: dueDate < today
    const today = new Date();
    expect(new Date(fetched.dueDate!) < today).toBe(true);
  });

  it("14. MAINTENANCE requiere proyecto", async () => {
    await expect(
      createIncome({ type: "MAINTENANCE", concept: "No proj", status: "PAID", amountUsd: 100, effectiveDate: "2026-01-01" }),
    ).rejects.toThrow("requieren proyecto");
  });

  it("15. cambiar proyecto actualiza el cliente", async () => {
    const p2 = await prisma.project.create({ data: { clientId, name: `inc-proj2-${Date.now()}`, isActive: true } });
    const inc = await createIncome({ type: "DEVELOPMENT", concept: "Move", status: "PAID", projectId, amountUsd: 100, effectiveDate: "2026-01-01" });
    track(inc.id);
    expect(inc.clientId).toBe(clientId);
    const updated = await updateIncome(inc.id, { type: "DEVELOPMENT", concept: inc.concept, status: "PAID", projectId: p2.id, amountUsd: 100, effectiveDate: "2026-01-01" });
    expect(updated.clientId).toBe(clientId); // both projects belong to same client
    expect(updated.projectId).toBe(p2.id);
    // Move income back to original project before cleaning p2
    await updateIncome(inc.id, { type: "DEVELOPMENT", concept: inc.concept, status: "PAID", projectId, amountUsd: 100, effectiveDate: "2026-01-01" });
    await prisma.project.delete({ where: { id: p2.id } });
  });

  it("16. quitar proyecto de OTHER limpia cliente derivado", async () => {
    const inc = await createIncome({ type: "OTHER", concept: "Other Proj", status: "PAID", projectId, amountUsd: 100, effectiveDate: "2026-01-01" });
    track(inc.id);
    expect(inc.clientId).toBe(clientId);
    const updated = await updateIncome(inc.id, { type: "OTHER", concept: inc.concept, status: "PAID", amountUsd: 100, effectiveDate: "2026-01-01" });
    expect(updated.clientId).toBeNull();
  });

  it("17. batch con proyecto invalido falla parcialmente", async () => {
    const result = await createIncomeBatch([
      { type: "DEVELOPMENT", projectId: "00000000-0000-0000-0000-000000000000", concept: "Bad", status: "PAID", amountUsd: 100, effectiveDate: "2026-01-01" },
    ]);
    expect(result.success).toBe(false);
  });

  it("18. batch con fechas en intervalos de 30 dias", async () => {
    const name = `Interval-${Date.now()}`;
    const result = await createIncomeBatch([
      { type: "OTHER", concept: name, status: "PENDING", amountUsd: 10, dueDate: "2027-01-31" },
      { type: "OTHER", concept: name, status: "PENDING", amountUsd: 10, dueDate: "2027-03-02" },
    ]);
    expect(result.success).toBe(true);
    const incs = await prisma.income.findMany({ where: { concept: name }, orderBy: { dueDate: "asc" } });
    expect(incs.length).toBe(2);
    incs.forEach(i => track(i.id));
    expect(incs[0].dueDate?.toISOString().slice(0,10)).toBe("2027-01-31");
  });
});
