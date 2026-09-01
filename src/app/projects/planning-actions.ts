"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  createPhase,
  updatePhase,
  deletePhase,
  phaseInputSchema,
} from "@/server/services/project-phases";
import {
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  setTaskPhase,
  setTaskClientVisible,
  taskInputSchema,
  taskUpdateSchema,
  TASK_STATUSES,
} from "@/server/services/project-tasks";
import { generateShareLink, revokeShareLink } from "@/server/services/project-sharing";

export type ActionResult = { success: true } | { success: false; message: string };

async function requireAuth() {
  if (!isAuthenticated()) throw new Error("Sesión expirada.");
}

function str(v: FormDataEntryValue | null): string | null {
  return v == null ? null : String(v).trim() || null;
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: FormDataEntryValue | null): boolean | undefined {
  if (v === null || v === "") return undefined;
  const s = String(v);
  if (s === "true" || s === "on" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export async function savePhase(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    const data = phaseInputSchema.parse({
      projectId: str(formData.get("projectId")),
      name: str(formData.get("name")),
      position: num(formData.get("position")),
    });
    if (id) {
      await updatePhase(id, { name: data.name, position: data.position });
    } else {
      await createPhase(data);
    }
    revalidatePath(`/projects/${data.projectId}`);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al guardar." };
  }
}

export async function removePhase(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    if (!id) return { success: false, message: "Fase no encontrada." };
    await deletePhase(id);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al eliminar." };
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function saveTask(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    const parsed = taskInputSchema.parse({
      projectId: str(formData.get("projectId")),
      phaseId: str(formData.get("phaseId")),
      name: str(formData.get("name")),
      description: str(formData.get("description")),
      type: str(formData.get("type")) ?? undefined,
      startDate: str(formData.get("startDate")),
      endDate: str(formData.get("endDate")),
      status: str(formData.get("status")) ?? undefined,
      position: num(formData.get("position")),
      clientVisible: bool(formData.get("clientVisible")),
    });

    if (id) {
      const update = taskUpdateSchema.parse({
        name: str(formData.get("name")) ?? undefined,
        description: str(formData.get("description")) ?? undefined,
        type: str(formData.get("type")) ?? undefined,
        startDate: str(formData.get("startDate")) ?? undefined,
        endDate: str(formData.get("endDate")) ?? undefined,
        position: num(formData.get("position")),
      });
      await updateTask(id, update);
    } else {
      await createTask(parsed);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al guardar." };
  }
}

export async function removeTask(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    if (!id) return { success: false, message: "Tarea no encontrada." };
    await deleteTask(id);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al eliminar." };
  }
}

export async function changeTaskStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    const status = str(formData.get("status"));
    if (!id || !status) return { success: false, message: "Datos incompletos." };
    if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
      return { success: false, message: "Estado inválido." };
    }
    await setTaskStatus(id, status as (typeof TASK_STATUSES)[number]);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al actualizar." };
  }
}

export async function changeTaskPhase(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    const phaseId = str(formData.get("phaseId"));
    if (!id) return { success: false, message: "Tarea no encontrada." };
    await setTaskPhase(id, phaseId);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al actualizar." };
  }
}

export async function changeTaskClientVisible(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const id = str(formData.get("id"));
    const visible = bool(formData.get("clientVisible"));
    if (!id || visible === undefined) {
      return { success: false, message: "Datos incompletos." };
    }
    await setTaskClientVisible(id, visible);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al actualizar." };
  }
}

// ---------------------------------------------------------------------------
// Share links (internal)
// ---------------------------------------------------------------------------

export async function generateShareLinkAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const projectId = str(formData.get("projectId"));
    if (!projectId) return { success: false, message: "Proyecto no encontrado." };
    await generateShareLink(projectId);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al generar." };
  }
}

export async function revokeShareLinkAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    requireAuth();
    const projectId = str(formData.get("projectId"));
    if (!projectId) return { success: false, message: "Proyecto no encontrado." };
    await revokeShareLink(projectId);
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error al revocar." };
  }
}
