"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { mapToGanttTasks, type PhaseDTO, type TaskDTO } from "./gantt-adapter";
import "frappe-gantt/dist/frappe-gantt.css";

type GanttMode = "Week" | "Month";

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
  const ganttRef = useRef<unknown>(null);
  const [mode, setMode] = useState<GanttMode>("Month");

  const dataKey = JSON.stringify({ phases, tasks, goLiveDate });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    let cancelled = false;

    (async () => {
      const Gantt = (await import("frappe-gantt")).default;
      if (cancelled || !el) return;

      const mapped = mapToGanttTasks(phases, tasks, goLiveDate);

      const gantt = new Gantt(el, mapped, {
        view_mode: mode,
        view_mode_select: false,
        readonly: true,
        readonly_dates: true,
        readonly_progress: true,
        today_button: false,
        infinite_padding: true,
        language: "es",
        lines: "both",
        bar_height: 36,
        padding: 26,
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
      } as unknown as ConstructorParameters<typeof Gantt>[2]);

      ganttRef.current = gantt;
    })();

    return () => {
      cancelled = true;
      el.innerHTML = "";
      ganttRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, mode]);

  const changeMode = (m: GanttMode) => {
    setMode(m);
    const gantt = ganttRef.current as { change_view_mode: (m: string) => void } | null;
    gantt?.change_view_mode(m);
  };

  const goToday = () => {
    const gantt = ganttRef.current as unknown as {
      scroll_current: () => void;
      set_scroll_position: (d: Date) => void;
    } | null;
    if (!gantt) return;
    gantt.scroll_current();
    setTimeout(() => {
      try {
        gantt.set_scroll_position(new Date());
      } catch {}
    }, 120);
  };

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
        <Button variant="ghost" onClick={goToday}>
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
