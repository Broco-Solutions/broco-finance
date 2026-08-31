import { PrismaClient } from "@prisma/client";

/**
 * Garantiza que existan los tipos de ingreso base y devuelve sus IDs.
 * Dev/Test: se pueden crear si no existen.
 */
export async function ensureIncomeTypes(prisma: PrismaClient) {
  const dev = await prisma.incomeType.upsert({ where: { name: "Desarrollo" }, update: {}, create: { name: "Desarrollo", requiresProject: true } });
  const maint = await prisma.incomeType.upsert({ where: { name: "Mantenimiento" }, update: {}, create: { name: "Mantenimiento", requiresProject: true } });
  const other = await prisma.incomeType.upsert({ where: { name: "Otro" }, update: {}, create: { name: "Otro", requiresProject: false } });
  return { dev: dev.id, maint: maint.id, other: other.id };
}
