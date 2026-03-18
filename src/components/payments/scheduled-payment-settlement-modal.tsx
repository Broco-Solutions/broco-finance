"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeType, ScheduledPaymentRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatShortDate, formatUsd, toFixedCurrencyInput } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function buildToday() {
  return new Date().toISOString().slice(0, 10);
}

export function ScheduledPaymentSettlementModal({
  demoMode,
  onClose,
  open,
  payment,
}: {
  demoMode: boolean;
  onClose: () => void;
  open: boolean;
  payment: Pick<
    ScheduledPaymentRecord,
    "expectedAmountUsd" | "expectedDate" | "id" | "projectName" | "status" | "type"
  > | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(buildToday());
  const [amountUsd, setAmountUsd] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!payment || !open) {
      return;
    }

    setError(null);
    setPaidAt(buildToday());
    setAmountUsd(toFixedCurrencyInput(payment.expectedAmountUsd));
    setNotes("");
  }, [open, payment]);

  if (!open || !payment || payment.status === "paid" || payment.status === "cancelled") {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(`/api/scheduled-payments/${payment.id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "mark_paid",
            paidAt,
            expectedAmountUsd: amountUsd ? Number(amountUsd) : null,
            notes: notes || null,
          }),
        });
        onClose();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el cobro.");
      }
    });
  };

  return (
    <EditEntityModal
      open={open}
      title="Registrar cobro"
      description={`Confirmá la cobranza de ${payment.projectName} y ajustá el importe final si hubo cambio comercial.`}
      submitLabel="Registrar cobro"
      widthClassName="max-w-2xl"
      isPending={isPending}
      disabled={demoMode}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        <div className="rounded-[1.35rem] border border-black/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,246,255,0.9))] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{payment.type === ("MAINTENANCE" satisfies IncomeType) ? "Mantenimiento" : "Desarrollo"}</Badge>
                <Badge tone="warning">Pendiente</Badge>
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</div>
              <div className="mt-1 truncate text-lg font-semibold text-ink">{payment.projectName}</div>
              <div className="mt-2 text-sm text-ink/58">Vencimiento original: {formatShortDate(payment.expectedDate)}</div>
            </div>

            <div className="min-w-[11rem] rounded-[1.2rem] border border-black/8 bg-white/88 px-4 py-3 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Importe previsto</div>
              <div className="mt-1 font-display text-3xl text-ink">{formatUsd(payment.expectedAmountUsd)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha de cobro</label>
            <Input
              className="h-12"
              type="date"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto final</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">
                USD
              </span>
              <Input
                className="h-12 pl-16 pr-4 font-medium tabular-nums"
                min="0"
                step="0.01"
                type="number"
                value={amountUsd}
                onChange={(event) => setAmountUsd(event.target.value)}
              />
            </div>
          </div>
        </div>

        {payment.type === ("MAINTENANCE" satisfies IncomeType) ? (
          <div className="rounded-[1.2rem] border border-emerald-900/15 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
            Si cambias el monto, se actualizará el valor de los meses futuros para este proyecto.
          </div>
        ) : null}

        <div className="space-y-2.5">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
          <Textarea
            className="min-h-[124px]"
            placeholder="Aclaraciones internas sobre el cobro, ajuste comercial o contexto del cliente."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </EditEntityModal>
  );
}
