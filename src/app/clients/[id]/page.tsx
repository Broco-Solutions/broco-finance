import Link from "next/link";
import { getClient } from "@/server/services/clients";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let client;
  try {
    client = await getClient(params.id);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Cliente" title="No encontrado" description="" meta={null} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cliente"
        title={client.name}
        description=""
        meta={
          <Badge tone="neutral">
            {client._count.projects} proyecto{client._count.projects !== 1 ? "s" : ""}
          </Badge>
        }
      />

      <Card>
        <h2 className="font-display text-xl text-ink">Datos de contacto</h2>
        <div className="mt-4 space-y-2 text-sm">
          <p><span className="text-ink/50">Contacto:</span> {client.contactName ?? "—"}</p>
          <p><span className="text-ink/50">Email:</span> {client.contactEmail ?? "—"}</p>
          <p><span className="text-ink/50">Telefono:</span> {client.contactPhone ?? "—"}</p>
          <p><span className="text-ink/50">Notas:</span> {client.notes ?? "—"}</p>
          <p className="text-ink/30 text-xs">
            Creado: {new Date(client.createdAt).toLocaleDateString("es-AR")} ·
            Actualizado: {new Date(client.updatedAt).toLocaleDateString("es-AR")}
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl text-ink">
          Proyectos ({client.projects.length})
        </h2>
        {client.projects.length === 0 ? (
          <p className="mt-4 text-ink/50">Sin proyectos.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {client.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-black/10 p-3"
              >
                <div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-medium text-cobalt underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-ink/50">
                    {p.isActive ? "Activo" : "Inactivo"}
                    {p.startDate && ` · Inicio: ${new Date(p.startDate).toLocaleDateString("es-AR")}`}
                    {p.endDate && ` · Fin: ${new Date(p.endDate).toLocaleDateString("es-AR")}`}
                  </div>
                </div>
                <Badge tone={p.isActive ? "success" : "neutral"}>
                  {p.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
