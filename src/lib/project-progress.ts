import { todayArg } from "@/lib/dates";

export type ProjectTaskTypeLite = "TASK" | "MILESTONE";
export type ProjectTaskStatusLite = "TODO" | "IN_PROGRESS" | "TO_REVIEW" | "BLOCKED" | "DONE";

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}

function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
}

export type ProjectProgress = {
  totalTasks: number;
  doneTasks: number;
  hasTasks: boolean;
  percent: number | null;
};

export function computeProjectProgress(
  tasks: { type: ProjectTaskTypeLite; status: ProjectTaskStatusLite; clientVisible?: boolean }[],
  opts: { onlyClientVisible?: boolean } = {},
): ProjectProgress {
  const relevant = opts.onlyClientVisible
    ? tasks.filter((t) => t.clientVisible !== false)
    : tasks;

  const taskList = relevant.filter((t) => t.type === "TASK");
  const totalTasks = taskList.length;
  const doneTasks = taskList.filter((t) => t.status === "DONE").length;

  return {
    totalTasks,
    doneTasks,
    hasTasks: totalTasks > 0,
    percent: totalTasks === 0 ? null : Math.round((doneTasks / totalTasks) * 100),
  };
}

export function computeElapsedPercent(
  startDate: Date | string | null,
  endDate: Date | string | null,
  now: Date = todayArg(),
): number | null {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return null;

  const s = dayNumber(start);
  const e = dayNumber(end);
  const n = dayNumber(now);

  if (n <= s) return 0;
  if (n >= e) return 100;

  const raw = ((n - s) / (e - s)) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export type GoLiveStatus = {
  hasDate: boolean;
  daysRemaining: number | null;
  isToday: boolean;
  isPast: boolean;
};

export function resolveGoLive(
  goLiveDate: Date | string | null,
  now: Date = todayArg(),
): GoLiveStatus {
  const g = toDate(goLiveDate);
  if (!g) {
    return { hasDate: false, daysRemaining: null, isToday: false, isPast: false };
  }
  const diff = dayNumber(g) - dayNumber(now);
  return {
    hasDate: true,
    daysRemaining: diff,
    isToday: diff === 0,
    isPast: diff < 0,
  };
}
