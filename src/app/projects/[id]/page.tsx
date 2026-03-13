import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { formatIncomeStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { getProjectDetail } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const detail = await getProjectDetail(params.id);
  const progress = detail.project.totalBudgetUsd
    ? Math.min((detail.project.totalCollectedUsd / detail.project.totalBudgetUsd) * 100, 100)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Proyecto"
        title={detail.project.name}
        description={`Cliente: ${detail.project.clientName}. ${detail.project.notes ?? "Sin notas operativas."}`}
        demoMode={!process.env.DATABASE_URL}
      />
      <Card>
        <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-ink/45">Cobrado</div>
            <div className="mt-3 font-display text-4xl text-ink">{formatUsd(detail.project.totalCollectedUsd)}</div>
          </div>
          {progress !== null ? (
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-ink/45">Presupuesto</div>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-black/8">
                <div className="h-full rounded-full bg-cobalt" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-ink/55">{progress.toFixed(1)}% del presupuesto cobrado</p>
            </div>
          ) : null}
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl text-ink">Ingresos</h2>
          <div className="mt-4">
            <DataTable headers={["Fecha", "USD", "Estado", "Notas"]}>
              {detail.incomes.map((income) => (
                <tr key={income.id}>
                  <td className="px-4 py-3">{formatShortDate(income.date)}</td>
                  <td className="px-4 py-3">{formatUsd(income.amountUsd)}</td>
                  <td className="px-4 py-3 uppercase">{formatIncomeStatus(income.status)}</td>
                  <td className="px-4 py-3">{income.notes ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-2xl text-ink">Pagos programados</h2>
          <div className="mt-4">
            <DataTable headers={["Fecha", "Monto", "Estado", "Notas"]}>
              {detail.scheduledPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">{formatShortDate(payment.expectedDate)}</td>
                  <td className="px-4 py-3">{formatUsd(payment.expectedAmountUsd)}</td>
                  <td className="px-4 py-3 uppercase">{payment.status}</td>
                  <td className="px-4 py-3">{payment.notes ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>
    </div>
  );
}
