"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeLedgerStatus, IncomeRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function MarkIncomePaidButton({
  income,
  demoMode,
  compact = false,
}: {
  income: Pick<
    IncomeRecord,
    "amountArs" | "amountUsd" | "dueDate" | "exchangeRate" | "id" | "notes" | "projectId" | "status" | "type"
  > & { displayStatus?: IncomeLedgerStatus };
  demoMode: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (income.status !== "PENDING") {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant={income.displayStatus === "OVERDUE" ? "primary" : "secondary"}
        className={compact ? "px-3 py-1.5 text-xs" : undefined}
        disabled={isPending || demoMode}
        onClick={() =>
          startTransition(async () => {
            try {
              setError(null);
              await apiFetch(`/api/incomes/${income.id}`, {
                method: "PUT",
                body: JSON.stringify({
                  projectId: income.projectId,
                  date: new Date().toISOString().slice(0, 10),
                  dueDate: income.dueDate,
                  status: "PAID",
                  type: income.type,
                  amountUsd: income.amountUsd,
                  amountArs: income.amountArs,
                  exchangeRate: income.exchangeRate,
                  notes: income.notes,
                }),
              });
              router.refresh();
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el cobro.");
            }
          })
        }
      >
        {demoMode ? "Demo" : isPending ? "Registrando…" : "Marcar cobrado"}
      </Button>
      {error ? <p className="text-[11px] text-brick">{error}</p> : null}
    </div>
  );
}
