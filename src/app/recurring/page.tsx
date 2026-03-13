import { RecurringScreen } from "@/components/screens/recurring-screen";
import { listProjects, listRecurring, listScheduledPayments } from "@/server/services/finance";

export default async function RecurringPage() {
  const [{ data: contracts, demoMode }, { data: payments }, { data: projects }] = await Promise.all([
    listRecurring(),
    listScheduledPayments(),
    listProjects(),
  ]);

  return <RecurringScreen contracts={contracts} payments={payments.slice(0, 6)} projects={projects} demoMode={demoMode} />;
}
