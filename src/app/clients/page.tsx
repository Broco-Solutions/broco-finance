import { ClientsScreen } from "@/components/screens/clients-screen";
import { listClients } from "@/server/services/finance";

export default async function ClientsPage() {
  const { data, demoMode } = await listClients(null);
  return <ClientsScreen clients={data} demoMode={demoMode} />;
}
