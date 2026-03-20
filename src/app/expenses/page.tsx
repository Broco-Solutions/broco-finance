import { ExpensesScreen } from "@/components/screens/expenses-screen";
import {
  listExpenseCategories,
  listExpenses,
  listProjects,
  listRecurringExpenses,
} from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [{ data: expenses, demoMode }, { data: categories }, { data: projects }, { data: recurringExpenses }] = await Promise.all([
    listExpenses(),
    listExpenseCategories(),
    listProjects(),
    listRecurringExpenses(),
  ]);

  return (
    <ExpensesScreen
      expenses={expenses}
      categories={categories}
      projects={projects}
      recurringExpenses={recurringExpenses}
      demoMode={demoMode}
    />
  );
}
