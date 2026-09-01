const LEGEND: { label: string; color: string }[] = [
  { label: "Por hacer", color: "#9ca3af" },
  { label: "En progreso", color: "#3b82f6" },
  { label: "A revisar", color: "#f59e0b" },
  { label: "Bloqueado", color: "#ef4444" },
  { label: "Hecho", color: "#22c55e" },
];

export function TaskStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink/60">
      {LEGEND.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
