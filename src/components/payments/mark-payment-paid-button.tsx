"use client";

import { useState } from "react";
import type { IncomeType, ScheduledPaymentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScheduledPaymentSettlementModal } from "@/components/payments/scheduled-payment-settlement-modal";

export function MarkPaymentPaidButton({
  paymentId,
  expectedDate,
  paymentStatus,
  paymentType,
  expectedAmountUsd,
  projectName,
  demoMode,
  compact = false,
}: {
  paymentId: string;
  expectedDate: string;
  paymentStatus: ScheduledPaymentStatus;
  paymentType: IncomeType;
  expectedAmountUsd: number;
  projectName: string;
  demoMode: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (paymentStatus === "paid" || paymentStatus === "cancelled") {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={paymentStatus === "overdue" ? "primary" : "secondary"}
        className={compact ? "px-3 py-1.5 text-xs" : undefined}
        disabled={demoMode}
        onClick={() => setOpen(true)}
      >
        {demoMode ? "Demo" : "Marcar como pagado"}
      </Button>

      <ScheduledPaymentSettlementModal
        demoMode={demoMode}
        open={open}
        payment={{
          id: paymentId,
          status: paymentStatus,
          type: paymentType,
          expectedDate,
          expectedAmountUsd,
          projectName,
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
