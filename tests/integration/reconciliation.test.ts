import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_TEST;
const skip = !url;

describe.skipIf(skip)("conciliacion exacta contra Excel", () => {
  it("ingresos ARS coinciden exactamente", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const [r] = await prisma.$queryRawUnsafe<[{ v: string }]>(
      "SELECT SUM(amount_ars)::text as v FROM incomes WHERE amount_ars IS NOT NULL",
    );
    expect(r.v).toBe("34661902.88");
    await prisma.$disconnect();
  });

  it("gastos ARS coinciden exactamente", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const [r] = await prisma.$queryRawUnsafe<[{ v: string }]>(
      "SELECT SUM(amount_ars)::text as v FROM expenses WHERE amount_ars IS NOT NULL",
    );
    expect(r.v).toBe("23277066.14");
    await prisma.$disconnect();
  });

  it("ingresos USD contable visible: ROUND(SUM,2) = 24024.94", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const [r] = await prisma.$queryRawUnsafe<[{ v: string }]>(
      "SELECT ROUND(SUM(amount_usd), 2)::text as v FROM incomes",
    );
    expect(r.v).toBe("24024.94");
    await prisma.$disconnect();
  });

  it("gastos USD contable visible: ROUND(SUM,2) = 16181.03", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const [r] = await prisma.$queryRawUnsafe<[{ v: string }]>(
      "SELECT ROUND(SUM(amount_usd), 2)::text as v FROM expenses",
    );
    expect(r.v).toBe("16181.03");
    await prisma.$disconnect();
  });
});
