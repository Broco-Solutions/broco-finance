import { ExpensesScreen } from "@/components/screens/expenses-screen";
import { listExpenseCategories, listExpenses, listProjects } from "@/server/services/finance";

export default async function ExpensesPage() {
  const [{ data: expenses, demoMode }, { data: categories }, { data: projects }] = await Promise.all([
    listExpenses(),
    listExpenseCategories(),
    listProjects(),
  ]);

  return <ExpensesScreen expenses={expenses} categories={categories} projects={projects} demoMode={demoMode} />;
}
