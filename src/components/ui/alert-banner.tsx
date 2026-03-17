"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCcw } from "lucide-react";
import type { AlertsPayload } from "@/lib/types";
import { formatShortDate, formatUsd } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function AlertBanner({ alerts }: { alerts: AlertsPayload }) {
  const hasAlerts =
    alerts.overdue.count > 0 ||
    alerts.upcoming7Days.count > 0 ||
    alerts.subscriptionsEndingSoon.count > 0;

  if (!hasAlerts) {
    return null;
  }

  return (
    <Card className="border-amber-900/15 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.98))]">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-amber-900/15 bg-amber-50 p-2 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-950">Alertas operativas</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Cobranza y renovación bajo seguimiento</h2>
            <p className="mt-2 max-w-3xl text-sm text-ink/62">
              El tablero consolida atrasos, cobros cercanos y contratos de mantenimiento próximos a vencer para no perder timing comercial.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[1.35rem] border border-brick/12 bg-white/85 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brick">Cobros vencidos</div>
            <div className="mt-2 font-display text-3xl text-ink">{formatUsd(alerts.overdue.totalUsd)}</div>
            <p className="mt-2 text-sm text-ink/60">
              {alerts.overdue.count} item{alerts.overdue.count === 1 ? "" : "s"} requieren seguimiento inmediato.
            </p>
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brick" href="/calendar" prefetch>
              Revisar calendario
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[1.35rem] border border-cobalt/12 bg-white/85 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt">Próximos 7 días</div>
            <div className="mt-2 font-display text-3xl text-ink">{formatUsd(alerts.upcoming7Days.totalUsd)}</div>
            <p className="mt-2 text-sm text-ink/60">
              {alerts.upcoming7Days.count} cobro{alerts.upcoming7Days.count === 1 ? "" : "s"} ya entran en ventana corta.
            </p>
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cobalt" href="/calendar" prefetch>
              Anticipar cobranza
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[1.35rem] border border-emerald-900/12 bg-white/85 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-950">
              <RefreshCcw className="h-3.5 w-3.5" />
              Renovaciones
            </div>
            <div className="mt-2 font-display text-3xl text-ink">{alerts.subscriptionsEndingSoon.count}</div>
            {alerts.subscriptionsEndingSoon.items.length > 0 ? (
              <div className="mt-2 space-y-2 text-sm text-ink/62">
                {alerts.subscriptionsEndingSoon.items.slice(0, 2).map((alert) => (
                  <div key={alert.projectId}>
                    <span className="font-semibold text-ink">{alert.clientName}</span>
                    {` · ${alert.projectName} · vence ${formatShortDate(alert.endDate)}`}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink/60">No hay contratos próximos a expirar.</p>
            )}
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-950" href="/projects" prefetch>
              Renovar contratos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
