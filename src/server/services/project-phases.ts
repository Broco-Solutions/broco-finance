import "server-only";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const phaseInputSchema = z.object({
  projectId: z.string().min(1, "El proyecto es obligatorio."),
  name: z.string().trim().min(1, "El nombre de la fase es obligatorio."),
  position: z.number().int().optional(),
});

export type PhaseInput = z.infer<typeof phaseInputSchema>;

export type PhaseUpdate = {
  name?: string;
  position?: number;
};

export async function listPhases(projectId: string) {
  return prisma.projectPhase.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

async function assertProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new Error("Proyecto no encontrado.");
}

async function nextPosition(projectId: string) {
  const agg = await prisma.projectPhase.aggregate({
    where: { projectId },
    _max: { position: true },
  });
  return (agg._max.position ?? -1) + 1;
}

export async function createPhase(input: PhaseInput) {
  const data = phaseInputSchema.parse(input);
  await assertProject(data.projectId);
  const position = data.position ?? (await nextPosition(data.projectId));
  const phase = await prisma.projectPhase.create({
    data: { projectId: data.projectId, name: data.name, position },
  });
  revalidatePath(`/projects/${data.projectId}`);
  return phase;
}

export async function updatePhase(id: string, input: PhaseUpdate) {
  const existing = await prisma.projectPhase.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!existing) throw new Error("Fase no encontrada.");

  const parsed = z
    .object({
      name: z.string().trim().min(1).optional(),
      position: z.number().int().optional(),
    })
    .parse(input);

  const phase = await prisma.projectPhase.update({
    where: { id },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.position !== undefined ? { position: parsed.position } : {}),
    },
  });
  revalidatePath(`/projects/${existing.projectId}`);
  return phase;
}

export async function deletePhase(id: string) {
  const existing = await prisma.projectPhase.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!existing) throw new Error("Fase no encontrada.");

  await prisma.projectPhase.delete({ where: { id } });
  revalidatePath(`/projects/${existing.projectId}`);
  return { id };
}
