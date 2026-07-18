import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;

describe.skipIf(skip)("proximos 30 dias", () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids) { try { await prisma.income.delete({ where: { id } }).catch(()=>{}); } catch {} }
    await prisma.$disconnect();
  });

  it("pendiente con vencimiento hoy: incluido en proximos 30d", async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "today-test", status: "PENDING", amountUsd: 10, dueDate: today } });
    ids.push(inc.id);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const found = await prisma.income.findFirst({ where: { id: inc.id, status: "PENDING", dueDate: { gte: today, lte: in30 } } });
    expect(found).not.toBeNull();
  });

  it("vencimiento exactamente en 30 dias: incluido", async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "in30-test", status: "PENDING", amountUsd: 10, dueDate: in30 } });
    ids.push(inc.id);
    const found = await prisma.income.findFirst({ where: { id: inc.id, status: "PENDING", dueDate: { gte: today, lte: in30 } } });
    expect(found).not.toBeNull();
  });

  it("vencimiento a 31 dias: excluido", async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in31 = new Date(today.getTime() + 31 * 86400000);
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "beyond30-test", status: "PENDING", amountUsd: 10, dueDate: in31 } });
    ids.push(inc.id);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const found = await prisma.income.findFirst({ where: { id: inc.id, status: "PENDING", dueDate: { gte: today, lte: in30 } } });
    expect(found).toBeNull();
  });

  it("vencido anterior a hoy: no aparece en proximos", async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today.getTime() - 86400000);
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "old-test", status: "PENDING", amountUsd: 10, dueDate: yesterday } });
    ids.push(inc.id);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const found = await prisma.income.findFirst({ where: { id: inc.id, status: "PENDING", dueDate: { gte: today, lte: in30 } } });
    expect(found).toBeNull();
  });

  it("movimiento cobrado: no aparece en proximos", async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in5 = new Date(today.getTime() + 5 * 86400000);
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "paid-test", status: "PAID", amountUsd: 10, effectiveDate: today, dueDate: in5 } });
    ids.push(inc.id);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const found = await prisma.income.findFirst({ where: { id: inc.id, status: "PENDING", dueDate: { gte: today, lte: in30 } } });
    expect(found).toBeNull();
  });
});
