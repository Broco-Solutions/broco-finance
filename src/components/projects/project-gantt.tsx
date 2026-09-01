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

      // Initial scroll: si hoy está dentro, ir a hoy; si no, ir al proyecto
      let initialScroll: string | undefined;
      if (mapped.length) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dates = mapped
          .map((t: { start: string; end: string }) => [new Date(t.start), new Date(t.end)])
          .flat()
          .map((d) => {
            const nd = new Date(d);
            nd.setHours(0, 0, 0, 0);
            return nd;
          });
        const min = new Date(Math.min(...dates.map((d) => d.getTime())));
        const max = new Date(Math.max(...dates.map((d) => d.getTime())));
        if (today < min || today > max) initialScroll = mapped[0].start;
        else initialScroll = today.toISOString().slice(0, 10);
      } else {
        initialScroll = new Date().toISOString().slice(0, 10);
      }

      let gantt: unknown;
      try {
        gantt = new Gantt(el, mapped, {
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
          ...(initialScroll ? { scroll_to: initialScroll } : {}),
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
      setTimeout(() => {
        try {
          const container = (gantt as unknown as { $container: HTMLElement }).$container;
          if (container && container.scrollLeft === 0 && initialScroll) {
            (gantt as unknown as { set_scroll_position: (d: string) => void }).set_scroll_position(initialScroll);
          }
        } catch {}
      }, 400);
      } catch {
        // Gantt creation failed (e.g., invalid tasks)
      }
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
      set_scroll_position: (d: Date | string) => void;
      gantt_start: Date;
      gantt_end: Date;
      setup_date_values: () => void;
      render: () => void;
    } | null;
    if (!gantt) return;
    const today = new Date();
    const isInside =
      gantt.gantt_start && gantt.gantt_end && today >= gantt.gantt_start && today <= gantt.gantt_end;
    if (isInside) {
      gantt.scroll_current();
      return;
    }
    // Fuera del rango: extender el rango para incluir hoy y luego navegar
    try {
      if (today < gantt.gantt_start) gantt.gantt_start = new Date(today);
      if (today > gantt.gantt_end) gantt.gantt_end = new Date(today);
      gantt.gantt_end.setHours(23, 59, 59, 999);
      gantt.setup_date_values();
      gantt.render();
    } catch {}
    try {
      gantt.set_scroll_position(today);
    } catch {
      try {
        gantt.scroll_current();
      } catch {}
    }
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
