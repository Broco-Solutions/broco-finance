import Link from "next/link";
import { MarkIncomePaidButton } from "@/components/payments/mark-income-paid-button";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatIncomeStatus, formatIncomeType, formatProjectStatus, formatScheduledPaymentStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { getClientDetail } from "@/server/services/finance";

export const dynamic = "force-dynamic";

function renderNotesCell(notes: string | null, widthClassName = "max-w-[14rem]") {
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

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const detail = await getClientDetail(params.id);
  const openPayments = [
    ...detail.pendingIncomes.map((income) => ({
      id: `income:${income.id}`,
      dueDate: income.dueDate ?? income.date,
      projectName: income.projectName,
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
    ...detail.payments.map((payment) => ({
      id: `scheduled:${payment.id}`,
      dueDate: payment.expectedDate,
      projectName: payment.projectName,
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
        eyebrow="Cliente"
        title={detail.client.name}
        description=""
        demoMode={!process.env.DATABASE_URL}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-950/50 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50/80">Acordado</div>
          <div className="mt-3 font-display text-4xl text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.28)]">
            {formatUsd(detail.client.totalInvoicedUsd)}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-ink/45">Por cobrar</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(detail.client.totalReceivableUsd)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-ink/45">Proyectos activos</div>
          <div className="mt-3 font-display text-4xl text-ink">{detail.client.activeProjects}</div>
        </Card>
      </div>
      <Card>
        <h2 className="font-display text-2xl text-ink">Proyectos</h2>
        <div className="mt-4">
          <DataTable headers={["Proyecto", "Estado", "Cobrado", "Desarrollo", "Fee mensual", "Acción"]} tableClassName="min-w-[58rem] table-fixed">
            {detail.projects.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3">{project.name}</td>
                <td className="px-4 py-3">{formatProjectStatus(project.status)}</td>
                <td className="px-4 py-3">{formatUsd(project.totalCollectedUsd)}</td>
                <td className="px-4 py-3">
                  {project.devBudgetUsd !== null
                    ? `${formatUsd(project.developmentCollectedUsd)} / ${formatUsd(project.devBudgetUsd)}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{formatUsd(project.monthlyFeeUsd)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/projects/${project.id}`}
                    prefetch
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-black/5"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl text-ink">Ingresos cobrados</h2>
          <div className="mt-4">
            <DataTable
              headers={["Fecha", "Corresponde a", "Proyecto", "Tipo", "Monto", "Notas"]}
              tableClassName="min-w-[58rem] table-fixed"
              colGroup={
                <colgroup>
                  <col className="w-[8.5rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[12rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[14rem]" />
                </colgroup>
              }
            >
              {detail.incomes.map((income) => (
                <tr key={income.id}>
                  <td className="px-4 py-3">{formatShortDate(income.date)}</td>
                  <td className="px-4 py-3">{formatShortDate(income.correspondsToDate ?? null)}</td>
                  <td className="px-4 py-3">{income.projectName}</td>
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
          <p className="mt-1 text-sm text-ink/55">Se listan todos los cobros abiertos del cliente, manuales y recurrentes, ordenados por vencimiento.</p>
          <div className="mt-4">
            {openPayments.length === 0 ? (
              <EmptyState title="Sin cobros abiertos" description="No hay pendientes ni vencidos para este cliente." />
            ) : (
              <DataTable
                headers={["Vence", "Proyecto", "Origen", "Tipo", "Monto", "Estado", "Acción"]}
                tableClassName="min-w-[62rem] table-fixed"
                colGroup={
                  <colgroup>
                    <col className="w-[8rem]" />
                    <col className="w-[14rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[8.5rem]" />
                    <col className="w-[11rem]" />
                  </colgroup>
                }
              >
                {openPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatShortDate(payment.dueDate)}</td>
                    <td className="px-4 py-3">{payment.projectName}</td>
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
