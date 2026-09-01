"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { mapToGanttTasks, type PhaseDTO, type TaskDTO } from "./gantt-adapter";
import "frappe-gantt/dist/frappe-gantt.css";

type GanttMode = "Week" | "Month";

type GanttInstance = {
  $container: HTMLElement;
  config: { column_width: number; step: number; unit: string };
  gantt_start: Date;
  gantt_end: Date;
  change_view_mode: (m: string) => void;
  set_scroll_position: (d: Date | string) => void;
  setup_date_values: () => void;
  render: () => void;
};

const MONTHS_FULL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTHS_ABBR = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// ---------------------------------------------------------------------------
// Custom view modes (Month default + calendar weeks LUN→DOM)
// ---------------------------------------------------------------------------

function weekLowerText(d: Date): string {
  const end = addDays(d, 6);
  const sameMonth = d.getFullYear() === end.getFullYear() && d.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${d.getDate()}–${end.getDate()} ${MONTHS_ABBR[end.getMonth()]}`;
  }
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]}–${end.getDate()} ${MONTHS_ABBR[end.getMonth()]}`;
}

const VIEW_MODES = [
  {
    name: "Month",
    padding: "2m",
    step: "1m",
    column_width: 120,
    date_format: "YYYY-MM",
    lower_text: "MMMM",
    upper_text: (d: Date, ld: Date | null) =>
      !ld || d.getFullYear() !== ld.getFullYear() ? String(d.getFullYear()) : "",
    thick_line: (d: Date) => d.getMonth() % 3 === 0,
    snap_at: "7d",
  },
  {
    name: "Week",
    padding: "1m",
    step: "7d",
    column_width: 140,
    date_format: "YYYY-MM-DD",
    lower_text: (d: Date) => weekLowerText(d),
    upper_text: (d: Date, ld: Date | null) =>
      !ld || d.getMonth() !== ld.getMonth() ? MONTHS_FULL[d.getMonth()] : "",
    thick_line: (d: Date) => d.getDate() >= 1 && d.getDate() <= 7,
    upper_text_frequency: 4,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeRange(mapped: { start: string; end: string }[]) {
  if (!mapped.length) return null;
  const dates = mapped
    .map((t) => [new Date(t.start), new Date(t.end)])
    .flat()
    .map((d) => {
      const nd = new Date(d);
      nd.setHours(0, 0, 0, 0);
      return nd;
    });
  return {
    min: new Date(Math.min(...dates.map((d) => d.getTime()))),
    max: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

function clampDate(d: Date, min: Date, max: Date): Date {
  if (d < min) return new Date(min);
  if (d > max) return new Date(max);
  return new Date(d);
}

function normalizeWeekRange(g: GanttInstance) {
  const start = new Date(g.gantt_start);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunes anterior o igual
  const end = new Date(g.gantt_end);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7)); // domingo posterior o igual
  g.gantt_start = start;
  g.gantt_end = end;
}

function centerDate(g: GanttInstance, date: Date, mode: GanttMode) {
  const container = g.$container;
  const colWidth = g.config.column_width;
  if (!container || !colWidth) return;
  const visible = Math.max(1, Math.floor(container.clientWidth / colWidth));
  const half = Math.floor(visible / 2);
  const target = new Date(date);
  if (mode === "Week") target.setDate(target.getDate() - half * 7);
  else target.setMonth(target.getMonth() - half);
  try {
    g.set_scroll_position(target);
  } catch {}
}

export function ProjectGantt({
  phases,
  tasks,
  goLiveDate,
  height,
}: {
  phases: PhaseDTO[];
  tasks: TaskDTO[];
  goLiveDate: string | null;
  height?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<GanttInstance | null>(null);
  const [mode, setMode] = useState<GanttMode>("Month");

  const mapped = mapToGanttTasks(phases, tasks, goLiveDate);
  const isEmpty = mapped.length === 0;
  const dataKey = JSON.stringify({ phases, tasks, goLiveDate });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isEmpty) return;
    el.innerHTML = "";
    let cancelled = false;

    (async () => {
      const Gantt = (await import("frappe-gantt")).default;
      if (cancelled || !el) return;

      let gantt: GanttInstance;
      try {
        gantt = new Gantt(
          el,
          mapped,
          {
            view_mode: "Month",
            view_modes: VIEW_MODES,
            view_mode_select: false,
            readonly: true,
            readonly_dates: true,
            readonly_progress: true,
            today_button: false,
            infinite_padding: true,
            auto_move_label: true,
            language: "es",
            lines: "both",
            bar_height: 36,
            padding: 26,
            holidays: { "var(--g-weekend-highlight-color)": "weekend" },
            ...(height !== undefined ? { container_height: height } : {}),
            popup: (
              ctx: {
                task: { name: string; typeLabel?: string; start?: string; end?: string; id?: string; statusLabel?: string };
                set_title: (s: string) => void;
                set_subtitle: (s: string) => void;
                set_details: (s: string) => void;
              },
            ) => {
              const task = ctx.task;
              ctx.set_title(task.name);
              ctx.set_subtitle(task.typeLabel ?? "");
              const start = task.start ? formatDate(task.start) : "—";
              const end = task.end ? formatDate(task.end) : "—";
              const dateText =
                task.id === "go-live" || start === end ? start : `${start} → ${end}`;
              ctx.set_details(dateText + (task.statusLabel ? ` · ${task.statusLabel}` : ""));
            },
          } as unknown as ConstructorParameters<typeof Gantt>[2],
        ) as unknown as GanttInstance;
      } catch {
        return;
      }

      ganttRef.current = gantt;

      // Foco inicial centrado (Month por defecto)
      setTimeout(() => {
        if (cancelled) return;
        const range = computeRange(mapped);
        const focus = range ? clampDate(new Date(), range.min, range.max) : new Date();
        centerDate(gantt, focus, "Month");
      }, 60);
    })();

    return () => {
      cancelled = true;
      el.innerHTML = "";
      ganttRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, isEmpty]);

  const changeMode = (m: GanttMode) => {
    setMode(m);
    const g = ganttRef.current;
    if (!g) return;
    try {
      g.change_view_mode(m);
      if (m === "Week") {
        normalizeWeekRange(g);
        g.setup_date_values();
        g.render();
      }
      const range = computeRange(mapped);
      const focus = range ? clampDate(new Date(), range.min, range.max) : new Date();
      centerDate(g, focus, m);
    } catch {}
  };

  const goToday = () => {
    const g = ganttRef.current;
    if (!g) return;
    const today = new Date();
    const inside = today >= g.gantt_start && today <= g.gantt_end;
    if (!inside) {
      try {
        if (today < g.gantt_start) g.gantt_start = new Date(today);
        if (today > g.gantt_end) g.gantt_end = new Date(today);
        g.gantt_end.setHours(23, 59, 59, 999);
        if (mode === "Week") normalizeWeekRange(g);
        g.setup_date_values();
        g.render();
      } catch {}
    }
    centerDate(g, today, mode);
  };

  if (isEmpty) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled>
            Mes
          </Button>
          <Button variant="secondary" disabled>
            Semana
          </Button>
          <Button variant="secondary" disabled>
            Hoy
          </Button>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-ink/60">
          No hay tareas para mostrar en el cronograma.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={mode === "Month" ? "primary" : "secondary"}
          onClick={() => changeMode("Month")}
        >
          Mes
        </Button>
        <Button
          variant={mode === "Week" ? "primary" : "secondary"}
          onClick={() => changeMode("Week")}
        >
          Semana
        </Button>
        <Button variant="secondary" onClick={goToday}>
          Hoy
        </Button>
      </div>
      <div
        ref={containerRef}
        className="gantt-wrapper rounded-lg border border-gray-200 bg-white p-2"
      />
    </div>
  );
}