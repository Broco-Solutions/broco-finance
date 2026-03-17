"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarRange, Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardDatePreset } from "@/lib/dashboard-date-range";
import { dashboardDatePresets } from "@/lib/dashboard-date-range";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function PresetButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition active:scale-[0.98]",
        active
          ? "border-ink bg-ink text-paper shadow-[0_12px_24px_rgba(16,21,34,0.14)]"
          : "border-black/10 bg-white/82 text-ink/72 hover:bg-black/[0.04] hover:text-ink",
      )}
      onClick={onClick}
      type="button"
    >
      {active ? <Check className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

export function DashboardDateRangeControls({
  endDate,
  preset,
  startDate,
}: {
  endDate: string;
  preset: DashboardDatePreset;
  startDate: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [customStartDate, setCustomStartDate] = useState(startDate);
  const [customEndDate, setCustomEndDate] = useState(endDate);

  useEffect(() => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
  }, [endDate, startDate]);

  const navigate = (nextPreset: DashboardDatePreset, nextStartDate?: string, nextEndDate?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", nextPreset);

    if (nextPreset === "custom") {
      if (nextStartDate) {
        params.set("startDate", nextStartDate);
      }
      if (nextEndDate) {
        params.set("endDate", nextEndDate);
      }
    } else {
      params.delete("startDate");
      params.delete("endDate");
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-2 md:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        {dashboardDatePresets.map((option) => (
          <PresetButton
            key={option.value}
            active={preset === option.value}
            onClick={() => {
              if (option.value === "custom") {
                navigate("custom", customStartDate, customEndDate);
                return;
              }

              navigate(option.value);
            }}
          >
            {option.value === "custom" ? <CalendarRange className="h-3.5 w-3.5" /> : null}
            {option.label}
          </PresetButton>
        ))}
      </div>

      {preset === "custom" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!customStartDate || !customEndDate) {
              return;
            }

            navigate("custom", customStartDate, customEndDate);
          }}
        >
          <Input className="h-10 min-w-[10.25rem] bg-white/88" type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
          <Input className="h-10 min-w-[10.25rem] bg-white/88" type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
          <Button type="submit" variant="secondary" className="h-10 px-4">
            {isPending ? "Actualizando…" : "Aplicar"}
          </Button>
        </form>
      ) : isPending ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Actualizando dashboard…</div>
      ) : null}
    </div>
  );
}
