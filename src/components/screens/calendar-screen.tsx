"use client";

import { useMemo, useState } from "react";
import type { ScheduledPaymentRecord } from "@/lib/types";
import { formatShortDate, formatUsd } from "@/lib/utils";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

function tone(status: ScheduledPaymentRecord["status"]) {
  if (status === "paid") return "bg-mint";
  if (status === "overdue") return "bg-brick/10 text-brick";
  if (status === "cancelled") return "bg-black/10";
  return "bg-cobalt/10 text-cobalt";
}

export function CalendarScreen({
  payments,
  demoMode,
}: {
  payments: ScheduledPaymentRecord[];
  demoMode: boolean;
}) {
  const [status, setStatus] = useState("");

  const visible = useMemo(
    () => (status ? payments.filter((payment) => payment.status === status) : payments),
    [payments, status],
  );

  const grouped = useMemo(
    () =>
      visible.reduce<Record<string, ScheduledPaymentRecord[]>>((acc, item) => {
        acc[item.expectedDate] ??= [];
        acc[item.expectedDate].push(item);
        return acc;
      }, {}),
    [visible],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Calendario"
        title="Cobranza próxima y vencida"
        description="La grilla agrupa cobros por fecha y conserva el estado operativo de cada `scheduled_payment`."
        demoMode={demoMode}
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">Timeline de cobros</h2>
            <p className="mt-1 text-sm text-ink/55">Vista lista priorizada por fecha esperada.</p>
          </div>
          <Select className="max-w-[220px]" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pending">pending</option>
            <option value="overdue">overdue</option>
            <option value="paid">paid</option>
            <option value="cancelled">cancelled</option>
          </Select>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="rounded-[1.35rem] border border-black/10 bg-white/75 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{formatShortDate(date)}</div>
              <div className="space-y-3">
                {items.map((payment) => (
                  <div key={payment.id} className={`rounded-2xl px-4 py-3 text-sm ${tone(payment.status)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{payment.clientName}</div>
                        <div className="text-xs uppercase tracking-[0.16em]">{payment.projectName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatUsd(payment.expectedAmountUsd)}</div>
                        <div className="mt-2">
                          <MarkPaymentPaidButton
                            paymentId={payment.id}
                            paymentStatus={payment.status}
                            paymentType={payment.type}
                            expectedAmountUsd={payment.expectedAmountUsd}
                            projectName={payment.projectName}
                            demoMode={demoMode}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <DataTable headers={["Fecha", "Cliente", "Proyecto", "Monto", "Estado", "Acción"]}>
          {visible.map((payment) => (
            <tr key={payment.id}>
              <td className="px-4 py-3">{formatShortDate(payment.expectedDate)}</td>
              <td className="px-4 py-3">{payment.clientName}</td>
              <td className="px-4 py-3">{payment.projectName}</td>
              <td className="px-4 py-3">{formatUsd(payment.expectedAmountUsd)}</td>
              <td className="px-4 py-3 uppercase">{payment.status}</td>
              <td className="px-4 py-3">
                <MarkPaymentPaidButton
                  paymentId={payment.id}
                  paymentStatus={payment.status}
                  paymentType={payment.type}
                  expectedAmountUsd={payment.expectedAmountUsd}
                  projectName={payment.projectName}
                  demoMode={demoMode}
                  compact
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
