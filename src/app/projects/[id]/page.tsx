import Link from "next/link";
import { getProject } from "@/server/services/projects";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatUsd, formatArs, formatDate } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let project;
  try {
    project = await getProject(params.id);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Proyecto" title="No encontrado" description="" meta={null} />
      </div>
    );
  }

  const fmtAmt = (currency: string | null, usd: unknown, orig: unknown, rate: unknown) => {
    if (!currency) return "No configurado";
    const u = Number(usd ?? 0);
    if (currency === "USD") return formatUsd(u);
    const a = Number(orig ?? 0);
    const r = Number(rate ?? 0);
    return `${formatArs(a)} → ${formatUsd(u)} (TC ${r.toFixed(2)})`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Proyecto"
        title={project.name}
        description={`Cliente: ${project.client.name}`}
        meta={
          <Badge tone={project.isActive ? "success" : "neutral"}>
            {project.isActive ? "Activo" : "Inactivo"}
          </Badge>
        }
      />

      <Card>
        <h2 className="font-display text-xl text-ink">Datos del proyecto</h2>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="text-ink/50">Cliente:</span>{" "}
            <Link href={`/clients/${project.clientId}`} className="text-cobalt underline">
              {project.client.name}
            </Link>
          </p>
          <p><span className="text-ink/50">Inicio:</span> {project.startDate ? new Date(project.startDate).toLocaleDateString("es-AR") : "—"}</p>
          <p><span className="text-ink/50">Fin:</span> {project.endDate ? new Date(project.endDate).toLocaleDateString("es-AR") : "—"}</p>
          <p><span className="text-ink/50">Notas:</span> {project.notes ?? "—"}</p>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-ink">Importes</h2>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="text-ink/50">Importe unico acordado:</span>{" "}
            {fmtAmt(
              project.oneTimeCurrency,
              project.oneTimeAmountUsd,
              project.oneTimeOriginalAmount,
              project.oneTimeExchangeRate,
            )}
          </p>
          <p>
            <span className="text-ink/50">Importe mensual informativo:</span>{" "}
            {fmtAmt(
              project.monthlyRecurringCurrency,
              project.monthlyRecurringAmountUsd,
              project.monthlyRecurringOriginalAmount,
              project.monthlyRecurringExchangeRate,
            )}
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-ink">Movimientos</h2>
        <div className="mt-4 space-y-3 text-sm">
          {/* Ingresos */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="font-medium text-ink">Ingresos</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
              <span>Total ({project._count.incomes}): <span className="font-semibold text-ink">{formatUsd(project._incomeTotals.all)}</span></span>
              <span>Cobrado: <span className="font-semibold text-emerald-600">{formatUsd(project._incomeTotals.paid)}</span></span>
              <span>Pendiente: <span className="font-semibold text-amber-600">{formatUsd(project._incomeTotals.pending)}</span></span>
            </div>
            {(project._incomeTotals.allArs as number) > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/50">
                <span>Total ARS: {formatArs(project._incomeTotals.allArs)}</span>
                <span>Cobrado ARS: {formatArs(project._incomeTotals.paidArs)}</span>
                <span>Pendiente ARS: {formatArs(project._incomeTotals.pendingArs)}</span>
              </div>
            )}
          </div>

          {/* Gastos */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="font-medium text-ink">Gastos</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
              <span>Total ({project._count.expenses}): <span className="font-semibold text-ink">{formatUsd(project._expenseTotals.all)}</span></span>
              <span>Pagado: <span className="font-semibold text-emerald-600">{formatUsd(project._expenseTotals.paid)}</span></span>
              <span>Pendiente: <span className="font-semibold text-amber-600">{formatUsd(project._expenseTotals.pending)}</span></span>
            </div>
            {(project._expenseTotals.allArs as number) > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/50">
                <span>Total ARS: {formatArs(project._expenseTotals.allArs)}</span>
                <span>Pagado ARS: {formatArs(project._expenseTotals.paidArs)}</span>
                <span>Pendiente ARS: {formatArs(project._expenseTotals.pendingArs)}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <p className="text-xs text-ink/30">
        Creado: {new Date(project.createdAt).toLocaleDateString("es-AR")} ·
        Actualizado: {new Date(project.updatedAt).toLocaleDateString("es-AR")}
      </p>
    </div>
  );
}
