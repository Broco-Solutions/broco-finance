import { IncomesScreen } from "@/components/screens/incomes-screen";
import { listIncomes, listProjects, listScheduledPayments } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function IncomesPage() {
  const [{ data: incomes, demoMode }, { data: scheduledPayments }, { data: projects }] = await Promise.all([
    listIncomes(),
    listScheduledPayments({ type: "MAINTENANCE" }),
    listProjects(),
  ]);

  return <IncomesScreen incomes={incomes} scheduledPayments={scheduledPayments} projects={projects} demoMode={demoMode} />;
}
