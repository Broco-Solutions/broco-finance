import { CalendarScreen } from "@/components/screens/calendar-screen";
import {
  listExpenseCategories,
  listExpenses,
  listIncomes,
  listProjects,
  listScheduledExpenses,
  listScheduledPayments,
} from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [
    { data: scheduledPayments, demoMode },
    { data: scheduledExpenses },
    { data: incomes },
    { data: expenses },
    { data: projects },
    { data: categories },
  ] = await Promise.all([
    listScheduledPayments(),
    listScheduledExpenses(),
    listIncomes(),
    listExpenses(),
    listProjects(),
    listExpenseCategories(),
  ]);

  return (
    <CalendarScreen
      categories={categories}
      demoMode={demoMode}
      expenses={expenses}
      incomes={incomes}
      projects={projects}
      scheduledExpenses={scheduledExpenses}
      scheduledPayments={scheduledPayments}
    />
  );
}
