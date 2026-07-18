import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { listClients } from "@/server/services/clients";
import { ClientList } from "./client-list";

export default async function ClientsPage() {
  let clients;
  try {
    clients = await listClients();
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Clientes" title="Clientes" description="" meta={null} />
        <p className="text-ink/50">Error al cargar clientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description=""
        meta={null}
        actions={
          <form action="/clients?new=1">
            <Button>Nuevo cliente</Button>
          </form>
        }
      />
      <ClientList clients={JSON.parse(JSON.stringify(clients))} />
    </div>
  );
}
