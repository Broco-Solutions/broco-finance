import Link from "next/link";
import { getProject } from "@/server/services/projects";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
    if (currency === "USD") return `USD ${u.toFixed(2)}`;
    const a = Number(orig ?? 0);
    const r = Number(rate ?? 0);
    return `ARS ${a.toFixed(2)} → USD ${u.toFixed(2)} (TC ${r.toFixed(2)})`;
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
        <div className="mt-4 space-y-2 text-sm">
          <p>Ingresos: {project._count.incomes}</p>
          <p>Gastos: {project._count.expenses}</p>
        </div>
      </Card>

      <p className="text-xs text-ink/30">
        Creado: {new Date(project.createdAt).toLocaleDateString("es-AR")} ·
        Actualizado: {new Date(project.updatedAt).toLocaleDateString("es-AR")}
      </p>
    </div>
  );
}
