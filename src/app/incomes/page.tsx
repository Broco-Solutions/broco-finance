import { IncomesScreen } from "@/components/screens/incomes-screen";
import { listIncomes, listProjects } from "@/server/services/finance";

export default async function IncomesPage() {
  const [{ data: incomes, demoMode }, { data: projects }] = await Promise.all([listIncomes(), listProjects()]);
  return <IncomesScreen incomes={incomes} projects={projects} demoMode={demoMode} />;
}
