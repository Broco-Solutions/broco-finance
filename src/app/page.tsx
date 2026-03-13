import nextDynamic from "next/dynamic";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatShortDate, formatUsd, toCurrencyNumber } from "@/lib/utils";
import { getDashboard } from "@/server/services/finance";

export const dynamic = "force-dynamic";

const MonthlyPerformanceChart = nextDynamic(
  () => import("@/components/dashboard/charts").then((module) => module.MonthlyPerformanceChart),
  { ssr: false },
);
const CategoryBreakdownChart = nextDynamic(
  () => import("@/components/dashboard/charts").then((module) => module.CategoryBreakdownChart),
  { ssr: false },
);
const CashflowChart = nextDynamic(
  () => import("@/components/dashboard/charts").then((module) => module.CashflowChart),
  { ssr: false },
);

export default async function DashboardPage() {
  const dashboard = await getDashboard();
  const demoMode = !process.env.DATABASE_URL;
  const kpis = {
    incomesUsd: toCurrencyNumber(dashboard.kpis.incomesUsd) ?? 0,
    expensesUsd: toCurrencyNumber(dashboard.kpis.expensesUsd) ?? 0,
    netUsd: toCurrencyNumber(dashboard.kpis.netUsd) ?? 0,
    remanenteUsd: toCurrencyNumber(dashboard.kpis.remanenteUsd) ?? 0,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="El tablero financiero que mira caja, cobranza y remanente real"
        description="Los filtros del dashboard no afectan el remanente: ese número siempre es histórico y acumulado. Todo lo demás sí se apoya en el período operativo."
        demoMode={demoMode}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard title="Ingresos" value={kpis.incomesUsd} detail="Período visible" tone="success" />
        <StatCard title="Egresos" value={kpis.expensesUsd} detail="Período visible" tone="danger" />
        <StatCard title="Resultado Neto" value={kpis.netUsd} detail="Ingresos - egresos" tone={kpis.netUsd >= 0 ? "success" : "danger"} />
        <StatCard title="Remanente" value={kpis.remanenteUsd} detail="Histórico real" tone="neutral" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <MonthlyPerformanceChart data={dashboard.charts.monthlyPerformance} />
        <CategoryBreakdownChart data={dashboard.charts.categoryBreakdown} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <CashflowChart data={dashboard.charts.cumulativeCashflow} />
        <Card>
          <h2 className="font-display text-2xl text-ink">Distribución en capas</h2>
          <div className="mt-6 space-y-4">
            {dashboard.distribution.map((layer) => (
              <div key={layer.id} className="rounded-[1.35rem] border border-black/10 bg-white/65 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-ink/45">{layer.layer}</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{layer.storageLocation ?? "Sin ubicación"}</div>
                  </div>
                  <div className="font-display text-3xl text-ink">{formatUsd(toCurrencyNumber(layer.currentAmountUsd))}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl text-ink">Próximos cobros</h2>
          <div className="mt-4">
            <DataTable headers={["Fecha", "Cliente", "Proyecto", "Monto", "Estado", "Acción"]}>
              {dashboard.upcomingPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">{formatShortDate(payment.expectedDate)}</td>
                  <td className="px-4 py-3">{payment.clientName}</td>
                  <td className="px-4 py-3">{payment.projectName}</td>
                  <td className="px-4 py-3">{formatUsd(toCurrencyNumber(payment.expectedAmountUsd))}</td>
                  <td className="px-4 py-3 uppercase">{payment.status}</td>
                  <td className="px-4 py-3">
                    <MarkPaymentPaidButton paymentId={payment.id} paymentStatus={payment.status} demoMode={demoMode} compact />
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl text-ink">Top clientes</h2>
          <div className="mt-4 space-y-4">
            {dashboard.charts.topClients.map((client) => (
              <div key={client.clientName} className="rounded-[1.35rem] border border-black/10 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{client.clientName}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-ink/45">
                      {client.activeProjects} activos · {client.pendingPayments} pendientes
                    </div>
                  </div>
                  <div className="font-display text-3xl text-ink">{formatUsd(toCurrencyNumber(client.incomeUsd))}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
