import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { formatIncomeType, formatProjectStatus, formatScheduledPaymentStatus, formatShortDate, formatUsd } from "@/lib/utils";
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

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const detail = await getClientDetail(params.id);

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
          <DataTable headers={["Proyecto", "Estado", "Cobrado", "Desarrollo", "Fee mensual"]}>
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
              headers={["Fecha", "Proyecto", "Tipo", "Monto", "Notas"]}
              tableClassName="min-w-[46rem] table-fixed"
              colGroup={
                <colgroup>
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
          <p className="mt-1 text-sm text-ink/55">Estos cobros recién impactan ingresos reales y remanente cuando se marcan como pagados.</p>
          <div className="mt-4">
            <DataTable headers={["Fecha", "Proyecto", "Tipo", "Monto", "Estado", "Acción"]} tableClassName="min-w-[50rem] table-fixed">
              {detail.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">{formatShortDate(payment.expectedDate)}</td>
                  <td className="px-4 py-3">{payment.projectName}</td>
                  <td className="px-4 py-3">{formatIncomeType(payment.type)}</td>
                  <td className="px-4 py-3">{formatUsd(payment.expectedAmountUsd)}</td>
                  <td className="px-4 py-3 uppercase">{formatScheduledPaymentStatus(payment.status)}</td>
                  <td className="px-4 py-3">
                    <MarkPaymentPaidButton
                      paymentId={payment.id}
                      paymentStatus={payment.status}
                      paymentType={payment.type}
                      expectedAmountUsd={payment.expectedAmountUsd}
                      projectName={payment.projectName}
                      demoMode={!process.env.DATABASE_URL}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>
    </div>
  );
}
