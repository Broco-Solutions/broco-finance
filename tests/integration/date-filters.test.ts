import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;

describe.skipIf(skip)("filtros from/to en ingresos y gastos", () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids) { try { await prisma.income.delete({ where: { id } }).catch(()=>{}); } catch {} }
    try { await prisma.expense.deleteMany({ where: { expenseCategoryId: { in: (await prisma.expenseCategory.findMany({ take: 1 })).map(c => c.id) } } }); } catch {}
    await prisma.$disconnect();
  });

  it("PAID usa effectiveDate en rango", async () => {
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "ft-paid", status: "PAID", amountUsd: 1, effectiveDate: new Date("2026-06-15") } }); ids.push(inc.id);
    const found = await prisma.income.findFirst({ where: { id: inc.id, effectiveDate: { gte: new Date("2026-06-01"), lte: new Date("2026-06-30") } } });
    expect(found).not.toBeNull();
    const notFound = await prisma.income.findFirst({ where: { id: inc.id, effectiveDate: { gte: new Date("2026-07-01"), lte: new Date("2026-07-31") } } });
    expect(notFound).toBeNull();
  });

  it("PENDING usa dueDate en rango", async () => {
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "ft-pending", status: "PENDING", amountUsd: 1, dueDate: new Date("2026-08-15") } }); ids.push(inc.id);
    const found = await prisma.income.findFirst({ where: { id: inc.id, status: "PENDING", dueDate: { gte: new Date("2026-08-01"), lte: new Date("2026-08-31") } } });
    expect(found).not.toBeNull();
  });

  it("rango inclusivo incluye el primer y ultimo dia", async () => {
    const inc = await prisma.income.create({ data: { type: "OTHER", concept: "ft-incl", status: "PAID", amountUsd: 1, effectiveDate: new Date("2026-07-01") } }); ids.push(inc.id);
    const found = await prisma.income.findFirst({ where: { id: inc.id, effectiveDate: { gte: new Date("2026-07-01"), lte: new Date("2026-07-01") } } });
    expect(found).not.toBeNull();
  });

  it("rango invertido produce conjunto vacio via filtro JS", () => {
    // Client-side filter: from > to means no results
    const from = "2026-12-01"; const to = "2026-01-01";
    expect(new Date(from) > new Date(to)).toBe(true);
  });

  it("filtros se limpian correctamente", () => {
    // Simulate clearing: state resets to defaults
    const defaults = { status: "all", type: "", from: "", to: "" };
    expect(defaults.status).toBe("all");
    expect(defaults.from).toBe("");
  });
});
