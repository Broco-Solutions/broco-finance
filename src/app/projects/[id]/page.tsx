import { MarkIncomePaidButton } from "@/components/payments/mark-income-paid-button";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatIncomeStatus, formatIncomeType, formatScheduledPaymentStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { getProjectDetail } from "@/server/services/finance";

export const dynamic = "force-dynamic";

function renderNotesCell(notes: string | null, widthClassName = "max-w-[15rem]") {
  const value = notes?.trim() || "—";
  return (
    <span className={`block truncate ${widthClassName}`} title={value === "—" ? undefined : value}>
      {value}
    </span>
  );
}

function sourceChip(source: "MANUAL" | "RECURRENT") {
  return source === "RECURRENT"
    ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
    : "border-black/10 bg-white text-ink/72";
}

function statusChip(status: "PENDING" | "OVERDUE" | "scheduled-pending" | "scheduled-overdue") {
  if (status === "OVERDUE" || status === "scheduled-overdue") {
    return "border-brick/20 bg-rose-50 text-brick";
  }

  return "border-amber-900/20 bg-amber-50 text-amber-950";
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const detail = await getProjectDetail(params.id);
  const progress = detail.project.devBudgetUsd
    ? Math.min((detail.project.developmentCollectedUsd / detail.project.devBudgetUsd) * 100, 100)
    : null;
  const openPayments = [
    ...detail.pendingIncomes.map((income) => ({
      id: `income:${income.id}`,
      dueDate: income.dueDate ?? income.date,
      source: "MANUAL" as const,
      type: income.type,
      amountUsd: income.amountUsd,
      status: income.displayStatus === "OVERDUE" ? ("OVERDUE" as const) : ("PENDING" as const),
      notes: income.notes,
      action: (
        <MarkIncomePaidButton
          income={income}
          demoMode={!process.env.DATABASE_URL}
          compact
        />
      ),
    })),
    ...detail.scheduledPayments.map((payment) => ({
      id: `scheduled:${payment.id}`,
      dueDate: payment.expectedDate,
      source: "RECURRENT" as const,
      type: payment.type,
      amountUsd: payment.expectedAmountUsd,
      status: payment.status === "overdue" ? ("scheduled-overdue" as const) : ("scheduled-pending" as const),
      notes: payment.notes,
      action: (
        <MarkPaymentPaidButton
          paymentId={payment.id}
          expectedDate={payment.expectedDate}
          paymentStatus={payment.status}
          paymentType={payment.type}
          expectedAmountUsd={payment.expectedAmountUsd}
          projectName={payment.projectName}
          demoMode={!process.env.DATABASE_URL}
          compact
        />
      ),
    })),
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Proyecto"
        title={detail.project.name}
        description=""
        demoMode={!process.env.DATABASE_URL}
      />

      {detail.project.pendingIncomeCount > 0 && detail.project.status !== "ACTIVE" ? (
        <Card className="border-coral/25 bg-coral/10">
          <div className="text-sm text-brick">
            Este proyecto tiene {detail.project.pendingIncomeCount} ingreso(s) pendientes todavía abiertos. Revisalos antes de cerrar la cobranza.
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-cobalt/15 bg-[linear-gradient(135deg,rgba(238,247,255,0.95),rgba(255,255,255,0.95))]">
          <div className="text-xs uppercase tracking-[0.16em] text-cobalt">Progreso de desarrollo</div>
          <div className="mt-3 font-display text-4xl text-ink">
            {detail.project.devBudgetUsd ? `${progress?.toFixed(1) ?? "0.0"}%` : "—"}
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/8">
            <div className="h-full rounded-full bg-cobalt" style={{ width: `${progress ?? 0}%` }} />
          </div>
          <p className="mt-3 text-sm text-ink/60">
            {formatUsd(detail.project.developmentCollectedUsd)} / {formatUsd(detail.project.devBudgetUsd)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">
            Saldo pendiente: {formatUsd(detail.project.developmentPendingUsd)}
          </p>
        </Card>

        <Card className="border-emerald-900/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))]">
          <div className="text-xs uppercase tracking-[0.16em] text-emerald-950">Estado de suscripción</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(detail.project.monthlyFeeUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Fee mensual vigente del mantenimiento.</p>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ink/45">
            Mantenimiento cobrado: {formatUsd(detail.project.maintenanceCollectedUsd)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">
            {detail.project.monthlyFeeEndDate
              ? `Vence ${formatShortDate(detail.project.monthlyFeeEndDate)}`
              : "Sin fecha de cierre"}
          </p>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-ink/45">Cobrado total</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(detail.project.totalCollectedUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Caja acumulada considerando desarrollo y mantenimiento.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl text-ink">Ingresos cobrados</h2>
          <div className="mt-4">
            <DataTable
              headers={["Fecha", "Corresponde a", "Tipo", "Monto", "Notas"]}
              tableClassName="min-w-[47rem] table-fixed"
              colGroup={
                <colgroup>
                  <col className="w-[8.5rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[15rem]" />
                </colgroup>
              }
            >
              {detail.incomes.map((income) => (
                <tr key={income.id}>
                  <td className="px-4 py-3">{formatShortDate(income.date)}</td>
                  <td className="px-4 py-3">{formatShortDate(income.correspondsToDate ?? null)}</td>
                  <td className="px-4 py-3">{formatIncomeType(income.type)}</td>
                  <td className="px-4 py-3">{formatUsd(income.amountUsd)}</td>
                  <td className="px-4 py-3">{renderNotesCell(income.notes)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-2xl text-ink">Pagos pendientes</h2>
          <p className="mt-1 text-sm text-ink/55">Acá aparecen los cobros manuales abiertos y las ocurrencias recurrentes del proyecto, ordenados por vencimiento.</p>
          <div className="mt-4">
            {openPayments.length === 0 ? (
              <EmptyState title="Sin cobros abiertos" description="No hay pendientes ni vencidos para este proyecto." />
            ) : (
              <DataTable
                headers={["Vence", "Origen", "Tipo", "Monto", "Estado", "Notas", "Acción"]}
                tableClassName="min-w-[58rem] table-fixed"
                colGroup={
                  <colgroup>
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[8.5rem]" />
                    <col className="w-[15rem]" />
                    <col className="w-[11rem]" />
                  </colgroup>
                }
              >
                {openPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatShortDate(payment.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${sourceChip(payment.source)}`}>
                        {payment.source === "RECURRENT" ? "Recurrente" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatIncomeType(payment.type)}</td>
                    <td className="px-4 py-3">{formatUsd(payment.amountUsd)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusChip(payment.status)}`}>
                        {payment.status === "scheduled-overdue"
                          ? formatScheduledPaymentStatus("overdue")
                          : payment.status === "scheduled-pending"
                            ? formatScheduledPaymentStatus("pending")
                            : formatIncomeStatus(payment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderNotesCell(payment.notes)}</td>
                    <td className="px-4 py-3">{payment.action}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
