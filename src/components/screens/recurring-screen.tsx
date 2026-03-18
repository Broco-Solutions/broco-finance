"use client";

import { useMemo, useState } from "react";
import type { ProjectRecord, ScheduledPaymentRecord } from "@/lib/types";
import { formatMonthLabel, formatProjectStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

function toMonthKey(value: string) {
  return value.slice(0, 7);
}

function compareMonthKeys(a: string, b: string) {
  return a.localeCompare(b);
}

export function RecurringScreen({
  payments,
  projects,
  demoMode,
}: {
  payments: ScheduledPaymentRecord[];
  projects: ProjectRecord[];
  demoMode: boolean;
}) {
  const maintenancePayments = useMemo(
    () => payments.filter((payment) => payment.type === "MAINTENANCE"),
    [payments],
  );
  const todayKey = new Date().toISOString().slice(0, 10);

  const subscribedProjects = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            ((project.monthlyFeeUsd ?? 0) > 0 && (!project.monthlyFeeEndDate || project.monthlyFeeEndDate >= todayKey)) ||
            maintenancePayments.some((payment) => payment.projectId === project.id),
        )
        .sort((left, right) => {
          const statusDelta = Number(right.status === "ACTIVE") - Number(left.status === "ACTIVE");
          if (statusDelta !== 0) {
            return statusDelta;
          }
          return (right.monthlyFeeUsd ?? 0) - (left.monthlyFeeUsd ?? 0);
        }),
    [maintenancePayments, projects, todayKey],
  );

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();

    for (const payment of maintenancePayments) {
      keys.add(toMonthKey(payment.expectedDate));
    }

    if (keys.size === 0) {
      keys.add(new Date().toISOString().slice(0, 7));
    }

    return Array.from(keys).sort(compareMonthKeys);
  }, [maintenancePayments]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(
    monthOptions.includes(currentMonthKey) ? currentMonthKey : monthOptions[monthOptions.length - 1],
  );

  const monthPayments = useMemo(
    () =>
      maintenancePayments
        .filter((payment) => toMonthKey(payment.expectedDate) === selectedMonth)
        .sort((left, right) => left.expectedDate.localeCompare(right.expectedDate)),
    [maintenancePayments, selectedMonth],
  );

  const summary = useMemo(
    () => ({
      activeSubscriptions: subscribedProjects.filter(
        (project) =>
          project.status === "ACTIVE" &&
          (project.monthlyFeeUsd ?? 0) > 0 &&
          (!project.monthlyFeeEndDate || project.monthlyFeeEndDate >= todayKey),
      ).length,
      monthlyRecurringRevenueUsd: subscribedProjects.reduce(
        (sum, project) =>
          sum +
          (project.status === "ACTIVE" && (!project.monthlyFeeEndDate || project.monthlyFeeEndDate >= todayKey)
            ? project.monthlyFeeUsd ?? 0
            : 0),
        0,
      ),
      pendingMonthUsd: monthPayments
        .filter((payment) => payment.status === "pending" || payment.status === "overdue")
        .reduce((sum, payment) => sum + payment.expectedAmountUsd, 0),
      collectedMonthUsd: monthPayments
        .filter((payment) => payment.status === "paid")
        .reduce((sum, payment) => sum + payment.expectedAmountUsd, 0),
    }),
    [monthPayments, subscribedProjects, todayKey],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recurrentes"
        title="Recurrentes"
        description=""
        demoMode={demoMode}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="border-emerald-950/35 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/80">Suscripciones activas</div>
          <div className="mt-3 font-display text-4xl text-white">{summary.activeSubscriptions}</div>
          <p className="mt-2 text-sm text-emerald-50/88">Proyectos activos con `monthlyFeeUsd` vigente.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt">MRR actual</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.monthlyRecurringRevenueUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Ingreso mensual teórico consolidado desde proyectos activos.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-950">Pendiente del mes</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.pendingMonthUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Cobros de mantenimiento todavía abiertos en el mes filtrado.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950">Cobrado del mes</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.collectedMonthUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Pagos de mantenimiento ya registrados como caja real.</p>
        </Card>
      </div>

      <Card className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink">Dashboard de suscripciones</h2>
            <p className="mt-1 text-sm text-ink/55">
              Crear o editar el fee mensual ocurre desde Proyectos. Esta vista solo opera la cobranza mensual.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">
              Mes de cobranza
            </label>
            <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {monthOptions.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthLabel(`${monthKey}-01`)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {subscribedProjects.length === 0 ? (
          <EmptyState
            title="Sin suscripciones activas"
            description="Cuando un proyecto tenga `monthlyFeeUsd` mayor a cero, aparecerá automáticamente en este tablero junto a su cronograma de mantenimiento."
          />
        ) : (
          <DataTable
            headers={["Cliente", "Proyecto", "Estado", "Fee mensual", "Fin", "Cobrado", "Saldo desarrollo"]}
            scrollAfter={8}
            tableClassName="min-w-[68rem] table-fixed"
            colGroup={
              <colgroup>
                <col className="w-[11rem]" />
                <col className="w-[14rem]" />
                <col className="w-[8.5rem]" />
                <col className="w-[9rem]" />
                <col className="w-[8rem]" />
                <col className="w-[8.5rem]" />
                <col className="w-[9rem]" />
              </colgroup>
            }
          >
            {subscribedProjects.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3">{project.clientName}</td>
                <td className="px-4 py-3 font-semibold text-ink">{project.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatProjectStatus(project.status)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatUsd(project.monthlyFeeUsd)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatShortDate(project.monthlyFeeEndDate)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatUsd(project.maintenanceCollectedUsd)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatUsd(project.developmentPendingUsd)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink">Cobros programados del mes</h2>
            <p className="mt-1 text-sm text-ink/55">
              Todos los ítems de esta tabla son `MAINTENANCE` y siempre refieren a su proyecto original.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-ink/45">
            {monthPayments.length} cobro{monthPayments.length === 1 ? "" : "s"} en {formatMonthLabel(`${selectedMonth}-01`)}
          </div>
        </div>

        {monthPayments.length === 0 ? (
          <EmptyState
            title="Sin cobros para este mes"
            description="No hay pagos de mantenimiento programados en el rango seleccionado."
          />
        ) : (
          <DataTable
            headers={["Vencimiento", "Cliente", "Proyecto", "Fee", "Estado", "Acción"]}
            scrollAfter={10}
            tableClassName="min-w-[58rem] table-fixed"
            colGroup={
              <colgroup>
                <col className="w-[8rem]" />
                <col className="w-[11rem]" />
                <col className="w-[14rem]" />
                <col className="w-[8rem]" />
                <col className="w-[8rem]" />
                <col className="w-[9rem]" />
              </colgroup>
            }
          >
            {monthPayments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-3 whitespace-nowrap">{formatShortDate(payment.expectedDate)}</td>
                <td className="px-4 py-3">{payment.clientName}</td>
                <td className="px-4 py-3">{payment.projectName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatUsd(payment.expectedAmountUsd)}</td>
                <td className="px-4 py-3 whitespace-nowrap uppercase">{payment.status}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <MarkPaymentPaidButton
                    paymentId={payment.id}
                    expectedDate={payment.expectedDate}
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
        )}
      </Card>
    </div>
  );
}
