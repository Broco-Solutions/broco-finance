"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeType, ScheduledPaymentRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { toFixedCurrencyInput } from "@/lib/utils";
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
    "expectedAmountUsd" | "id" | "projectName" | "status" | "type"
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
      isPending={isPending}
      disabled={demoMode}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha de cobro</label>
            <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </div>
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
        </div>

        {payment.type === ("MAINTENANCE" satisfies IncomeType) ? (
          <div className="rounded-[1.2rem] border border-emerald-900/15 bg-emerald-50/80 p-4 text-sm text-emerald-950">
            Si cambias el monto, se actualizará el valor de los meses futuros para este proyecto.
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </div>
    </EditEntityModal>
  );
}
