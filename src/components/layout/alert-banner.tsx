"use client";

import Link from "next/link";
import type { AlertsPayload } from "@/lib/types";
import { formatUsd } from "@/lib/utils";

export function AlertBanner({ alerts }: { alerts: AlertsPayload | null }) {
  if (!alerts) {
    return <div className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-ink/50">Sincronizando alertas…</div>;
  }

  if (alerts.overdue.count === 0 && alerts.upcoming7Days.count === 0) {
    return (
      <div className="rounded-full border border-black/10 bg-mint px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
        Todo al día
      </div>
    );
  }

  return (
    <Link
      href="/calendar"
      className="inline-flex flex-wrap items-center gap-3 rounded-full border border-brick/10 bg-brick/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-brick transition hover:bg-brick/10"
    >
      <span>{alerts.overdue.count} vencidos</span>
      <span>{alerts.upcoming7Days.count} próximos</span>
      <span>{formatUsd(alerts.overdue.totalUsd + alerts.upcoming7Days.totalUsd)}</span>
    </Link>
  );
}
