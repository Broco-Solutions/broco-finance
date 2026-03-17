"use client";

import { useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

function ActionCard({
  description,
  disabled = false,
  icon,
  label,
  onClick,
  tone,
}: {
  description: string;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "expense" | "income";
}) {
  return (
    <button
      className={cn(
        "rounded-[1.4rem] border px-4 py-4 text-left transition",
        tone === "income"
          ? "border-emerald-900/15 bg-emerald-50/80 text-emerald-950"
          : "border-orange-900/15 bg-orange-50/85 text-orange-950",
        !disabled && "hover:-translate-y-px hover:shadow-[0_18px_35px_rgba(16,21,34,0.08)] active:scale-[0.98]",
        disabled && "cursor-not-allowed opacity-45",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {icon}
        </span>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-1 text-xs leading-5 text-current/72">{description}</div>
        </div>
      </div>
    </button>
  );
}

export function DayActionModal({
  date,
  expenseDisabled = false,
  incomeDisabled = false,
  onClose,
  onCreateExpense,
  onCreateIncome,
  open,
}: {
  date: string | null;
  expenseDisabled?: boolean;
  incomeDisabled?: boolean;
  onClose: () => void;
  onCreateExpense: () => void;
  onCreateIncome: () => void;
  open: boolean;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open || !date) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        aria-label="Cerrar selector de día"
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full max-w-lg">
        <Card className="border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-0 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
          <div className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt">Nuevo movimiento</div>
                <h3 className="mt-2 font-display text-3xl text-ink">
                  {format(parseISO(date), "d 'de' MMMM", { locale: es })}
                </h3>
                <p className="mt-2 text-sm text-ink/60">Elegí si querés abrir un ingreso o un gasto con la fecha ya preseleccionada.</p>
              </div>
              <button
                aria-label="Cerrar selector"
                className="rounded-full border border-black/10 bg-white/90 p-2 text-ink/70 transition hover:bg-black/5 hover:text-ink"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ActionCard
                description="Ideal para development o mantenimiento manual."
                disabled={incomeDisabled}
                icon={<ArrowUpRight className="h-4 w-4" />}
                label="Nuevo ingreso"
                onClick={onCreateIncome}
                tone="income"
              />
              <ActionCard
                description="Usalo cuando el egreso ya salió o querés dejarlo cargado ese día."
                disabled={expenseDisabled}
                icon={<ArrowDownRight className="h-4 w-4" />}
                label="Nuevo gasto"
                onClick={onCreateExpense}
                tone="expense"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
