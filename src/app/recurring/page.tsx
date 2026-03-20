import { RecurringScreen } from "@/components/screens/recurring-screen";
import {
  listExpenseCategories,
  listProjects,
  listRecurringExpenses,
  listRecurringIncomes,
} from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [{ data: recurringIncomes, demoMode }, { data: recurringExpenses }, { data: projects }, { data: categories }] = await Promise.all([
    listRecurringIncomes(),
    listRecurringExpenses(),
    listProjects(),
    listExpenseCategories(),
  ]);

  return (
    <RecurringScreen
      recurringIncomes={recurringIncomes}
      recurringExpenses={recurringExpenses}
      projects={projects}
      categories={categories}
      demoMode={demoMode}
    />
  );
}
