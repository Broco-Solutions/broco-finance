import { RecurringScreen } from "@/components/screens/recurring-screen";
import { listProjects, listScheduledPayments } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [{ data: payments, demoMode }, { data: projects }] = await Promise.all([
    listScheduledPayments({ type: "MAINTENANCE" }),
    listProjects(),
  ]);

  return <RecurringScreen payments={payments} projects={projects} demoMode={demoMode} />;
}
