export type GanttStatus = "TODO" | "IN_PROGRESS" | "TO_REVIEW" | "BLOCKED" | "DONE";
export type GanttTaskType = "TASK" | "MILESTONE";

export type PhaseDTO = { id: string; name: string; position: number };
export type TaskDTO = {
  id: string;
  phaseId: string | null;
  name: string;
  description: string | null;
  type: GanttTaskType;
  startDate: string;
  endDate: string;
  status: GanttStatus;
  position: number;
  clientVisible: boolean;
};

export type GanttTask = {
  id: string;
  name: string;
  start: string;
  end: string;
  type: string;
  custom_class: string;
  statusLabel?: string;
  typeLabel?: string;
};

const STATUS_CLASS: Record<GanttStatus, string> = {
  TODO: "gantt-status-todo",
  IN_PROGRESS: "gantt-status-in-progress",
  TO_REVIEW: "gantt-status-to-review",
  BLOCKED: "gantt-status-blocked",
  DONE: "gantt-status-done",
};

const STATUS_LABEL: Record<GanttStatus, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  TO_REVIEW: "A revisar",
  BLOCKED: "Bloqueado",
  DONE: "Hecho",
};

export function statusToClass(status: string): string {
  return STATUS_CLASS[status as GanttStatus] ?? STATUS_CLASS.TODO;
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as GanttStatus] ?? STATUS_LABEL.TODO;
}

export function typeLabel(type: string): string {
  return type === "MILESTONE" ? "Hito" : "Tarea";
}

function toISODate(value: string): string {
  const d = new Date(value);
  return d.toISOString().slice(0, 10);
}

function nextDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function taskToGantt(t: TaskDTO): GanttTask {
  const isMilestone = t.type === "MILESTONE";
  const end = isMilestone ? nextDay(t.startDate) : t.endDate;
  return {
    id: `task-${t.id}`,
    name: t.name,
    start: toISODate(t.startDate),
    end: toISODate(end),
    type: "task",
    custom_class: (isMilestone ? "gantt-milestone " : "") + statusToClass(t.status),
    statusLabel: statusLabel(t.status),
    typeLabel: typeLabel(t.type),
  };
}

export function mapToGanttTasks(
  phases: PhaseDTO[],
  tasks: TaskDTO[],
  goLiveDate: string | null,
): GanttTask[] {
  const result: GanttTask[] = [];

  const sortedPhases = [...phases].sort((a, b) => a.position - b.position);
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);

  for (const phase of sortedPhases) {
    const phaseTasks = sortedTasks.filter((t) => t.phaseId === phase.id);
    if (phaseTasks.length === 0) continue;

    const starts = phaseTasks
      .map((t) => t.startDate)
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    const ends = phaseTasks
      .map((t) => t.endDate)
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    if (starts.length === 0) continue;

    const pStart = toISODate(new Date(Math.min(...starts)).toISOString());
    const pEnd = toISODate(new Date(Math.max(...ends)).toISOString());

    result.push({
      id: `phase-${phase.id}`,
      name: phase.name,
      start: pStart,
      end: pEnd,
      type: "task",
      custom_class: "gantt-phase",
    });

    for (const t of phaseTasks) result.push(taskToGantt(t));
  }

  for (const t of sortedTasks.filter((t) => !t.phaseId)) {
    result.push(taskToGantt(t));
  }

  if (goLiveDate) {
    result.push({
      id: "go-live",
      name: "Go Live",
      start: toISODate(goLiveDate),
      end: nextDay(goLiveDate),
      type: "task",
      custom_class: "gantt-go-live",
    });
  }

  return result;
}
