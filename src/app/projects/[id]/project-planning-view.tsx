"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TaskStatusBadge, TaskTypeBadge } from "@/components/projects/task-status-badge";
import { ProjectGantt } from "@/components/projects/project-gantt";
import { ProjectSharePanel } from "@/components/projects/project-share-panel";
import { formatDate } from "@/lib/utils";
import {
  computeProjectProgress,
  computeElapsedPercent,
  resolveGoLive,
} from "@/lib/project-progress";
import type { ActionResult } from "@/app/projects/planning-actions";
import {
  savePhase,
  removePhase,
  saveTask,
  removeTask,
  changeTaskStatus,
  changeTaskPhase,
  changeTaskClientVisible,
} from "@/app/projects/planning-actions";

type Status = "TODO" | "IN_PROGRESS" | "TO_REVIEW" | "BLOCKED" | "DONE";
type TaskType = "TASK" | "MILESTONE";

type PhaseDTO = { id: string; name: string; position: number };
type TaskDTO = {
  id: string;
  phaseId: string | null;
  name: string;
  description: string | null;
  type: TaskType;
  startDate: string;
  endDate: string;
  status: Status;
  position: number;
  clientVisible: boolean;
};

const STATUS_OPTIONS: Status[] = ["TODO", "IN_PROGRESS", "TO_REVIEW", "BLOCKED", "DONE"];
const STATUS_LABEL: Record<Status, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  TO_REVIEW: "A revisar",
  BLOCKED: "Bloqueado",
  DONE: "Hecho",
};

function goLiveText(g: { hasDate: boolean; daysRemaining: number | null; isToday: boolean }): string {
  if (!g.hasDate) return "—";
  if (g.isToday) return "Hoy";
  if (g.daysRemaining != null && g.daysRemaining < 0) return `Hace ${-g.daysRemaining} días`;
  return `${g.daysRemaining} días`;
}

export function ProjectPlanningView({
  projectId,
  phases: initialPhases,
  tasks: initialTasks,
  projectStartDate,
  projectEndDate,
  projectGoLiveDate,
  shareLinkStatus,
}: {
  projectId: string;
  phases: PhaseDTO[];
  tasks: TaskDTO[];
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectGoLiveDate: string | null;
  shareLinkStatus: "active" | "revoked" | null;
}) {
  const router = useRouter();
  const [phases, setPhases] = useState<PhaseDTO[]>(initialPhases);
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [banner, setBanner] = useState<string | null>(null);

  const [phaseModal, setPhaseModal] = useState<{ open: boolean; editing?: PhaseDTO }>({ open: false });
  const [taskModal, setTaskModal] = useState<{ open: boolean; editing?: TaskDTO }>({ open: false });
  const [deletePhaseTarget, setDeletePhaseTarget] = useState<PhaseDTO | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TaskDTO | null>(null);

  useEffect(() => setPhases(initialPhases), [initialPhases]);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const refresh = () => router.refresh();

  const progress = computeProjectProgress(tasks);
  const elapsed = computeElapsedPercent(projectStartDate, projectEndDate);
  const goLive = resolveGoLive(projectGoLiveDate);

  const tasksByPhase = new Map<string, TaskDTO[]>();
  const unphased: TaskDTO[] = [];
  for (const t of tasks) {
    if (t.phaseId) {
      const list = tasksByPhase.get(t.phaseId) ?? [];
      list.push(t);
      tasksByPhase.set(t.phaseId, list);
    } else {
      unphased.push(t);
    }
  }

  const runAction = async (
    action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>,
    build: (fd: FormData) => void,
  ) => {
    setBanner(null);
    const fd = new FormData();
    build(fd);
    const r = await action(null, fd);
    if (!r.success) {
      setBanner(r.message);
      return;
    }
    refresh();
  };

  const empty = phases.length === 0 && tasks.length === 0;

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Avance completado" value={progress.hasTasks ? `${progress.percent}%` : "Sin tareas"} />
        <Metric label="Tiempo transcurrido" value={elapsed === null ? "—" : `${elapsed}%`} />
        <Metric label="Para Go Live" value={goLiveText(goLive)} />
      </div>

      <Card>
        <h2 className="font-display text-xl text-ink">Compartir con cliente</h2>
        <p className="mt-1 text-sm text-ink/60">
          Generá un enlace privado y de solo lectura para que el cliente siga el avance del proyecto.
        </p>
        <div className="mt-3">
          <ProjectSharePanel projectId={projectId} initialStatus={shareLinkStatus} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Planificación</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPhaseModal({ open: true })}>Nueva fase</Button>
          <Button onClick={() => setTaskModal({ open: true })}>Nueva tarea</Button>
        </div>
      </div>

      {banner && (
        <p className="rounded-lg border border-brick/30 bg-brick/5 px-3 py-2 text-sm text-brick">{banner}</p>
      )}

      {empty && (
        <Card>
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-ink/60">Este proyecto todavía no tiene planificación cargada.</p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setPhaseModal({ open: true })}>Nueva fase</Button>
              <Button onClick={() => setTaskModal({ open: true })}>Nueva tarea</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Fases */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const phaseTasks = tasksByPhase.get(phase.id) ?? [];
          return (
            <Card key={phase.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg text-ink">{phase.name}</h3>
                <div className="flex gap-1">
                  <Button variant="secondary" className="text-xs" onClick={() => setPhaseModal({ open: true, editing: phase })}>Editar</Button>
                  <Button variant="secondary" className="text-xs text-brick" onClick={() => setDeletePhaseTarget(phase)}>Eliminar</Button>
                </div>
              </div>
              {phaseTasks.length === 0 ? (
                <p className="mt-3 text-sm text-ink/40">Esta fase no tiene tareas todavía.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {phaseTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      phases={phases}
                      onStatus={(s) => runAction(changeTaskStatus, (fd) => { fd.set("id", t.id); fd.set("status", s); })}
                      onPhase={(p) => runAction(changeTaskPhase, (fd) => { fd.set("id", t.id); fd.set("phaseId", p); })}
                      onVisible={(v) => runAction(changeTaskClientVisible, (fd) => { fd.set("id", t.id); fd.set("clientVisible", v ? "true" : "false"); })}
                      onEdit={() => setTaskModal({ open: true, editing: t })}
                      onDelete={() => setDeleteTaskTarget(t)}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Tareas sin fase */}
      {unphased.length > 0 && (
        <Card>
          <h3 className="font-display text-lg text-ink">Tareas sin fase</h3>
          <div className="mt-3 space-y-2">
            {unphased.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                phases={phases}
                onStatus={(s) => runAction(changeTaskStatus, (fd) => { fd.set("id", t.id); fd.set("status", s); })}
                onPhase={(p) => runAction(changeTaskPhase, (fd) => { fd.set("id", t.id); fd.set("phaseId", p); })}
                onVisible={(v) => runAction(changeTaskClientVisible, (fd) => { fd.set("id", t.id); fd.set("clientVisible", v ? "true" : "false"); })}
                onEdit={() => setTaskModal({ open: true, editing: t })}
                onDelete={() => setDeleteTaskTarget(t)}
              />
            ))}
          </div>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-xl text-ink">Cronograma</h2>
        <ProjectGantt phases={phases} tasks={tasks} goLiveDate={projectGoLiveDate} />
      </section>

      <PhaseFormModal
        open={phaseModal.open}
        title={phaseModal.editing ? "Editar fase" : "Nueva fase"}
        initial={phaseModal.editing}
        projectId={projectId}
        onClose={() => setPhaseModal({ open: false })}
        onSubmit={(fd) => savePhase(null, fd)}
      />

      <TaskFormModal
        open={taskModal.open}
        title={taskModal.editing ? "Editar tarea" : "Nueva tarea"}
        initial={taskModal.editing}
        projectId={projectId}
        phases={phases}
        onClose={() => setTaskModal({ open: false })}
        onSubmit={(fd) => saveTask(null, fd)}
      />

      <ConfirmActionModal
        open={!!deletePhaseTarget}
        title="Eliminar fase"
        description={`¿Eliminar "${deletePhaseTarget?.name}"? Las tareas asociadas quedarán sin fase (no se eliminan).`}
        confirmLabel="Eliminar"
        isPending={false}
        error={null}
        onClose={() => setDeletePhaseTarget(null)}
        onConfirm={() => {
          if (!deletePhaseTarget) return;
          const target = deletePhaseTarget;
          setDeletePhaseTarget(null);
          runAction(removePhase, (fd) => { fd.set("id", target.id); });
        }}
      />

      <ConfirmActionModal
        open={!!deleteTaskTarget}
        title="Eliminar tarea"
        description={`¿Eliminar "${deleteTaskTarget?.name}"?`}
        confirmLabel="Eliminar"
        isPending={false}
        error={null}
        onClose={() => setDeleteTaskTarget(null)}
        onConfirm={() => {
          if (!deleteTaskTarget) return;
          const target = deleteTaskTarget;
          setDeleteTaskTarget(null);
          runAction(removeTask, (fd) => { fd.set("id", target.id); });
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="space-y-1">
        <div className="font-display text-3xl text-ink">{value}</div>
        <div className="text-xs uppercase tracking-wider text-ink/50">{label}</div>
      </div>
    </Card>
  );
}

function TaskRow({
  task,
  phases,
  onStatus,
  onPhase,
  onVisible,
  onEdit,
  onDelete,
}: {
  task: TaskDTO;
  phases: PhaseDTO[];
  onStatus: (s: string) => void;
  onPhase: (p: string) => void;
  onVisible: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateText =
    task.type === "MILESTONE"
      ? formatDate(task.startDate)
      : `${formatDate(task.startDate)}${task.endDate && task.endDate !== task.startDate ? ` → ${formatDate(task.endDate)}` : ""}`;

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{task.name}</span>
            <TaskTypeBadge type={task.type} />
            <TaskStatusBadge status={task.status} />
          </div>
          {task.description && <p className="mt-1 text-xs text-ink/55">{task.description}</p>}
          <p className="mt-1 text-xs text-ink/50">{dateText}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="secondary" className="text-xs" onClick={onEdit}>Editar</Button>
          <Button variant="secondary" className="text-xs text-brick" onClick={onDelete}>Eliminar</Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          className="h-8 w-auto text-xs"
          value={task.status}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Estado"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </Select>
        <Select
          className="h-8 w-auto text-xs"
          value={task.phaseId ?? ""}
          onChange={(e) => onPhase(e.target.value)}
          aria-label="Fase"
        >
          <option value="">Sin fase</option>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-xs text-ink/60">
          <input type="checkbox" checked={task.clientVisible} onChange={(e) => onVisible(e.target.checked)} />
          Cliente
        </label>
      </div>
    </div>
  );
}

function PhaseFormModal({
  open,
  title,
  initial,
  projectId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: PhaseDTO;
  projectId: string;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<ActionResult>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      if (initial) fd.set("id", initial.id);
      fd.set("name", name);
      const r = await onSubmit(fd);
      if (!r.success) {
        setError(r.message);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6">
        <button aria-label="Cerrar" className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} type="button" />
        <div className="relative flex min-h-full items-start justify-center sm:items-center">
          <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
            <h2 className="font-display text-2xl text-ink">{title}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input placeholder="Nombre de la fase" value={name} onChange={(e) => setName(e.target.value)} required />
              {error && <p className="text-sm text-brick">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function TaskFormModal({
  open,
  title,
  initial,
  projectId,
  phases,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: TaskDTO;
  projectId: string;
  phases: PhaseDTO[];
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<ActionResult>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [phaseId, setPhaseId] = useState(initial?.phaseId ?? "");
  const [type, setType] = useState<TaskType>(initial?.type ?? "TASK");
  const [startDate, setStartDate] = useState(initial?.startDate ? initial.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(initial?.endDate ? initial.endDate.slice(0, 10) : "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "TODO");
  const [clientVisible, setClientVisible] = useState(initial?.clientVisible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setPhaseId(initial?.phaseId ?? "");
    setType(initial?.type ?? "TASK");
    setStartDate(initial?.startDate ? initial.startDate.slice(0, 10) : "");
    setEndDate(initial?.endDate ? initial.endDate.slice(0, 10) : "");
    setStatus(initial?.status ?? "TODO");
    setClientVisible(initial?.clientVisible ?? true);
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      if (initial) fd.set("id", initial.id);
      fd.set("name", name);
      if (description.trim()) fd.set("description", description.trim());
      fd.set("phaseId", phaseId);
      fd.set("type", type);
      fd.set("startDate", startDate);
      fd.set("endDate", type === "MILESTONE" ? startDate : endDate);
      fd.set("status", status);
      fd.set("clientVisible", clientVisible ? "true" : "false");
      const r = await onSubmit(fd);
      if (!r.success) {
        setError(r.message);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6">
        <button aria-label="Cerrar" className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} type="button" />
        <div className="relative flex min-h-full items-start justify-center sm:items-center">
          <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
            <h2 className="font-display text-2xl text-ink">{title}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
              <textarea
                placeholder="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[72px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <Select value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                <option value="">Sin fase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                <option value="TASK">Tarea</option>
                <option value="MILESTONE">Hito</option>
              </Select>
              <Input type="date" placeholder="Fecha de inicio" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              {type === "TASK" && (
                <Input type="date" placeholder="Fecha de fin" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              )}
              <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} />
                Visible para el cliente
              </label>
              {error && <p className="text-sm text-brick">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
