"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function MarkPaymentPaidButton({
  paymentId,
  paymentStatus,
  demoMode,
  compact = false,
}: {
  paymentId: string;
  paymentStatus: "pending" | "paid" | "overdue" | "cancelled";
  demoMode: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (paymentStatus === "paid" || paymentStatus === "cancelled") {
    return null;
  }

  const handleClick = () => {
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(`/api/scheduled-payments/${paymentId}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "mark_paid",
            paidAt: new Date().toISOString().slice(0, 10),
          }),
        });
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el cobro.");
      }
    });
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={paymentStatus === "overdue" ? "primary" : "secondary"}
        className={compact ? "px-3 py-1.5 text-xs" : undefined}
        disabled={isPending || demoMode}
        onClick={handleClick}
      >
        {demoMode ? "Demo" : isPending ? "Registrando…" : "Marcar como pagado"}
      </Button>
      {error ? <p className="text-xs text-brick">{error}</p> : null}
    </div>
  );
}
