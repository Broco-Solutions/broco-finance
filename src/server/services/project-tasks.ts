import "server-only";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const TASK_TYPES = ["TASK", "MILESTONE"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "TO_REVIEW", "BLOCKED", "DONE"] as const;

export type ProjectTaskType = (typeof TASK_TYPES)[number];
export type ProjectTaskStatus = (typeof TASK_STATUSES)[number];

export const taskInputSchema = z.object({
  projectId: z.string().min(1, "El proyecto es obligatorio."),
  phaseId: z.string().nullable().optional(),
  name: z.string().trim().min(1, "El nombre de la tarea es obligatorio."),
  description: z.string().trim().nullable().optional(),
  type: z.enum(TASK_TYPES).optional(),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria."),
  endDate: z.string().min(1, "La fecha de fin es obligatoria."),
  status: z.enum(TASK_STATUSES).optional(),
  position: z.number().int().optional(),
  clientVisible: z.boolean().optional(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  type: z.enum(TASK_TYPES).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  position: z.number().int().optional(),
});

export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export function resolveTaskDates(
  type: ProjectTaskType,
  startDate: string,
  endDate: string,
): { startDate: Date; endDate: Date } {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) throw new Error("Fecha de inicio inválida.");

  if (type === "MILESTONE") {
    return { startDate: start, endDate: start };
  }

  const end = new Date(endDate);
  if (isNaN(end.getTime())) throw new Error("Fecha de fin inválida.");
  if (start.getTime() > end.getTime()) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
  }
  return { startDate: start, endDate: end };
}

async function assertProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) throw new Error("Proyecto no encontrado.");
}

async function assertPhaseBelongsToProject(phaseId: string, projectId: string) {
  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    select: { id: true, projectId: true },
  });
  if (!phase) throw new Error("Fase no encontrada.");
  if (phase.projectId !== projectId) {
    throw new Error("La fase no pertenece a este proyecto.");
  }
}

export async function listTasks(projectId: string) {
  return prisma.projectTask.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { startDate: "asc" }],
  });
}

async function nextPosition(projectId: string) {
  const agg = await prisma.projectTask.aggregate({
    where: { projectId },
    _max: { position: true },
  });
  return (agg._max.position ?? -1) + 1;
}

export async function createTask(input: TaskInput) {
  const data = taskInputSchema.parse(input);
  await assertProject(data.projectId);
  if (data.phaseId) await assertPhaseBelongsToProject(data.phaseId, data.projectId);

  const type = data.type ?? "TASK";
  const status = data.status ?? "TODO";
  const dates = resolveTaskDates(type, data.startDate, data.endDate);
  const position = data.position ?? (await nextPosition(data.projectId));

  const task = await prisma.projectTask.create({
    data: {
      projectId: data.projectId,
      phaseId: data.phaseId ?? null,
      name: data.name,
      description: data.description?.trim() || null,
      type,
      startDate: dates.startDate,
      endDate: dates.endDate,
      status,
      position,
      clientVisible: data.clientVisible ?? true,
    },
  });
  revalidatePath(`/projects/${data.projectId}`);
  return task;
}

export async function updateTask(id: string, input: TaskUpdate) {
  const existing = await prisma.projectTask.findUnique({
    where: { id },
    select: { id: true, projectId: true, type: true, startDate: true, endDate: true },
  });
  if (!existing) throw new Error("Tarea no encontrada.");

  const data = taskUpdateSchema.parse(input);
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description?.trim() || null;
  if (data.position !== undefined) update.position = data.position;

  if (data.type !== undefined || data.startDate || data.endDate) {
    const type = data.type ?? existing.type;
    const startStr = data.startDate ?? existing.startDate.toISOString().slice(0, 10);
    const endStr = data.endDate ?? existing.endDate.toISOString().slice(0, 10);
    const dates = resolveTaskDates(type, startStr, endStr);
    update.type = type;
    update.startDate = dates.startDate;
    update.endDate = dates.endDate;
  }

  const task = await prisma.projectTask.update({ where: { id }, data: update });
  revalidatePath(`/projects/${existing.projectId}`);
  return task;
}

export async function deleteTask(id: string) {
  const existing = await prisma.projectTask.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!existing) throw new Error("Tarea no encontrada.");
  await prisma.projectTask.delete({ where: { id } });
  revalidatePath(`/projects/${existing.projectId}`);
  return { id };
}

export async function setTaskStatus(id: string, status: ProjectTaskStatus) {
  const existing = await prisma.projectTask.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!existing) throw new Error("Tarea no encontrada.");
  z.enum(TASK_STATUSES).parse(status);

  const task = await prisma.projectTask.update({ where: { id }, data: { status } });
  revalidatePath(`/projects/${existing.projectId}`);
  return task;
}

export async function setTaskPhase(id: string, phaseId: string | null) {
  const existing = await prisma.projectTask.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!existing) throw new Error("Tarea no encontrada.");
  if (phaseId) await assertPhaseBelongsToProject(phaseId, existing.projectId);

  const task = await prisma.projectTask.update({ where: { id }, data: { phaseId } });
  revalidatePath(`/projects/${existing.projectId}`);
  return task;
}

export async function setTaskClientVisible(id: string, clientVisible: boolean) {
  const existing = await prisma.projectTask.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!existing) throw new Error("Tarea no encontrada.");
  const task = await prisma.projectTask.update({ where: { id }, data: { clientVisible } });
  revalidatePath(`/projects/${existing.projectId}`);
  return task;
}
