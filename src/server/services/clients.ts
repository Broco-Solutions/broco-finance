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
  return client;
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
