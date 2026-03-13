import { ExpensesScreen } from "@/components/screens/expenses-screen";
import {
  listExpenseCategories,
  listExpenses,
  listProjects,
  listRecurringExpenses,
  listScheduledExpenses,
} from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [
    { data: expenses, demoMode },
    { data: categories },
    { data: projects },
    { data: recurringExpenses },
    { data: scheduledExpenses },
  ] = await Promise.all([
    listExpenses(),
    listExpenseCategories(),
    listProjects(),
    listRecurringExpenses(),
    listScheduledExpenses({
      status: "PENDING",
      currentMonth: true,
      includeOverdue: true,
    }),
  ]);

  return (
    <ExpensesScreen
      expenses={expenses}
      categories={categories}
      projects={projects}
      recurringExpenses={recurringExpenses}
      scheduledExpenses={scheduledExpenses}
      demoMode={demoMode}
    />
  );
}
