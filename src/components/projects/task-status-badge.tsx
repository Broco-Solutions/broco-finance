import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  TODO: { label: "Por hacer", className: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "En progreso", className: "bg-blue-100 text-blue-700" },
  TO_REVIEW: { label: "A revisar", className: "bg-amber-100 text-amber-800" },
  BLOCKED: { label: "Bloqueado", className: "bg-red-100 text-red-700" },
  DONE: { label: "Hecho", className: "bg-green-100 text-green-800" },
};

const TYPE_MAP: Record<string, { label: string; className: string }> = {
  TASK: { label: "Tarea", className: "bg-slate-100 text-slate-600" },
  MILESTONE: { label: "Hito", className: "bg-purple-100 text-purple-700" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.TODO;
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", s.className)}>
      {s.label}
    </span>
  );
}

export function TaskTypeBadge({ type }: { type: string }) {
  const s = TYPE_MAP[type] ?? TYPE_MAP.TASK;
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", s.className)}>
      {s.label}
    </span>
  );
}
