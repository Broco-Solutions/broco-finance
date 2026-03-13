"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ScheduledExpenseRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatShortDate, formatUsd, toFixedCurrencyInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PayScheduledExpenseModal({
  demoMode,
  onClose,
  open,
  scheduledExpense,
}: {
  demoMode: boolean;
  onClose: () => void;
  open: boolean;
  scheduledExpense: ScheduledExpenseRecord | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amountUsd, setAmountUsd] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduledExpense) {
      return;
    }

    setAmountUsd(toFixedCurrencyInput(scheduledExpense.amountUsd));
    setPaidAt(new Date().toISOString().slice(0, 10));
    setError(null);
  }, [scheduledExpense]);

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
  }, [open, onClose]);

  if (!open || !scheduledExpense) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(`/api/scheduled-expenses/${scheduledExpense.id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "mark_paid",
            amountUsd: Number(amountUsd),
            paidAt,
          }),
        });
        onClose();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el pago.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full max-w-xl">
        <Card className="border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-0 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
          <form className="space-y-5 p-6" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-coral">Pago operativo</div>
                <h3 className="mt-2 font-display text-3xl text-ink">Registrar gasto recurrente</h3>
                <p className="mt-2 max-w-lg text-sm text-ink/60">
                  El gasto impacta resultado neto y remanente recién al pagarlo. Podés ajustar el monto final antes de confirmarlo.
                </p>
              </div>
              <button
                aria-label="Cerrar modal"
                className="rounded-full border border-black/10 bg-white/90 p-2 text-ink/70 transition hover:bg-black/5 hover:text-ink"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[1.3rem] border border-black/8 bg-white/85 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{scheduledExpense.categoryName}</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{scheduledExpense.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Programado</div>
                  <div className="mt-1 font-display text-3xl text-ink">{formatUsd(scheduledExpense.amountUsd)}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-ink/60">Vencimiento original: {formatShortDate(scheduledExpense.dueDate)}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto final USD</label>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={amountUsd}
                  onChange={(event) => setAmountUsd(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha real de pago</label>
                <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
              </div>
            </div>

            {error ? <p className="text-sm text-brick">{error}</p> : null}
            {demoMode ? <p className="text-sm text-ink/55">La persistencia del pago requiere `DATABASE_URL`.</p> : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-black/8 pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button disabled={isPending || demoMode || !amountUsd} type="submit">
                {isPending ? "Registrando…" : "Confirmar pago"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
