import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ensureIncomeTypes } from "../helpers/income-types";
import { getDashboard } from "@/server/services/dashboard";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;

describe.skipIf(skip)("ingresos por tipo", () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const ids: string[] = [];
  let devId = "";
  let mantId = "";

  beforeAll(async () => {
    if (skip) return;
    const types = await ensureIncomeTypes(prisma);
    devId = types.dev;
    mantId = types.maint;
    // create 2 dev, 1 mant in current month
    const dev1 = await prisma.income.create({ data: { typeId: devId, concept: "dev1", status: "PAID", amountUsd: 100, effectiveDate: new Date() } });
    const dev2 = await prisma.income.create({ data: { typeId: devId, concept: "dev2", status: "PAID", amountUsd: 200, effectiveDate: new Date() } });
    const mant = await prisma.income.create({ data: { typeId: mantId, concept: "mant1", status: "PAID", amountUsd: 50, effectiveDate: new Date() } });
    ids.push(dev1.id, dev2.id, mant.id);
  });

  afterAll(async () => {
    for (const id of ids) await prisma.income.delete({ where: { id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("agrupa por tipo solo Desarrollo/Mantenimiento", async () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const data = await getDashboard(from, to);
    const items = (data as any).incomeTypeBreakdown.items;
    expect(items.length).toBeGreaterThanOrEqual(2);
    const dev = items.find((i: any) => i.name === "Desarrollo");
    const mant = items.find((i: any) => i.name === "Mantenimiento");
    expect(dev).toBeDefined();
    expect(mant).toBeDefined();
    expect(dev.total).toBeGreaterThanOrEqual(300);
    expect(mant.total).toBeGreaterThanOrEqual(50);
    // No Otros
    const otro = items.find((i: any) => i.name === "Otro");
    expect(otro).toBeUndefined();
  });
});
