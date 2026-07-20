import "server-only";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  contactName: z.string().trim().nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .email("Email invalido.")
    .nullable()
    .optional()
    .or(z.literal("")),
  contactPhone: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;

function nullIfEmpty(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function listClients() {
  return prisma.client.findMany({
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      _count: { select: { projects: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        select: {
          id: true,
          name: true,
          isActive: true,
          startDate: true,
          endDate: true,
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      },
      _count: { select: { projects: true, incomes: true } },
    },
  });
  if (!client) throw new Error("Cliente no encontrado.");

  const projectIds = client.projects.map((p) => p.id);

  // Client-level totals
  const [incAll, incPaid, incPending, expAll, expPaid, expPending] = await Promise.all([
    prisma.income.aggregate({ where: { clientId: id }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.income.aggregate({ where: { clientId: id, status: "PAID" }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.income.aggregate({ where: { clientId: id, status: "PENDING" }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.expense.aggregate({ where: { projectId: { in: projectIds } }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.expense.aggregate({ where: { projectId: { in: projectIds }, status: "PAID" }, _sum: { amountUsd: true, amountArs: true } }),
    prisma.expense.aggregate({ where: { projectId: { in: projectIds }, status: "PENDING" }, _sum: { amountUsd: true, amountArs: true } }),
  ]);

  // Per-project totals
  let projectsWithTotals = client.projects.map((p) => ({ ...p }));
  if (projectIds.length > 0) {
    const [incByProj, incByProjPaid, incByProjPending, expByProj, expByProjPaid, expByProjPending] =
      await Promise.all([
        prisma.income.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _sum: { amountUsd: true, amountArs: true } }),
        prisma.income.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, status: "PAID" }, _sum: { amountUsd: true, amountArs: true } }),
        prisma.income.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, status: "PENDING" }, _sum: { amountUsd: true, amountArs: true } }),
        prisma.expense.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _sum: { amountUsd: true, amountArs: true } }),
        prisma.expense.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, status: "PAID" }, _sum: { amountUsd: true, amountArs: true } }),
        prisma.expense.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, status: "PENDING" }, _sum: { amountUsd: true, amountArs: true } }),
      ]);

    const byPid = new Map<string, Record<string, number>>();
    for (const pid of projectIds) {
      byPid.set(pid, {
        incAll: Number(incByProj.find((r) => r.projectId === pid)?._sum.amountUsd ?? 0),
        incPaid: Number(incByProjPaid.find((r) => r.projectId === pid)?._sum.amountUsd ?? 0),
        incPending: Number(incByProjPending.find((r) => r.projectId === pid)?._sum.amountUsd ?? 0),
        expAll: Number(expByProj.find((r) => r.projectId === pid)?._sum.amountUsd ?? 0),
        expPaid: Number(expByProjPaid.find((r) => r.projectId === pid)?._sum.amountUsd ?? 0),
        expPending: Number(expByProjPending.find((r) => r.projectId === pid)?._sum.amountUsd ?? 0),
      });
    }

    projectsWithTotals = client.projects.map((p) => ({ ...p, ...byPid.get(p.id) }));
  }

  return {
    ...client,
    projects: projectsWithTotals,
    _incomeTotals: {
      all: Number(incAll._sum.amountUsd ?? 0), paid: Number(incPaid._sum.amountUsd ?? 0), pending: Number(incPending._sum.amountUsd ?? 0),
      allArs: Number(incAll._sum.amountArs ?? 0), paidArs: Number(incPaid._sum.amountArs ?? 0), pendingArs: Number(incPending._sum.amountArs ?? 0),
    },
    _expenseTotals: {
      all: Number(expAll._sum?.amountUsd ?? 0), paid: Number(expPaid._sum?.amountUsd ?? 0), pending: Number(expPending._sum?.amountUsd ?? 0),
      allArs: Number(expAll._sum?.amountArs ?? 0), paidArs: Number(expPaid._sum?.amountArs ?? 0), pendingArs: Number(expPending._sum?.amountArs ?? 0),
    },
  };
}

export async function createClient(input: ClientInput) {
  const data = clientSchema.parse(input);
  try {
    const client = await prisma.client.create({
      data: {
        name: data.name,
        contactName: nullIfEmpty(data.contactName),
        contactEmail: nullIfEmpty(data.contactEmail),
        contactPhone: nullIfEmpty(data.contactPhone),
        notes: nullIfEmpty(data.notes),
      },
    });
    revalidatePath("/clients");
    return client;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new Error("Ya existe un cliente con ese nombre.");
    }
    throw error;
  }
}

export async function updateClient(id: string, input: ClientInput) {
  const data = clientSchema.parse(input);
  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        contactName: nullIfEmpty(data.contactName),
        contactEmail: nullIfEmpty(data.contactEmail),
        contactPhone: nullIfEmpty(data.contactPhone),
        notes: nullIfEmpty(data.notes),
      },
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return client;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new Error("Ya existe un cliente con ese nombre.");
    }
    throw error;
  }
}

export async function deleteClient(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      _count: { select: { projects: true, incomes: true } },
    },
  });
  if (!client) throw new Error("Cliente no encontrado.");

  if (client._count.projects > 0 || client._count.incomes > 0) {
    throw new Error(
      "No se puede eliminar el cliente porque tiene proyectos o ingresos asociados.",
    );
  }

  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
}
