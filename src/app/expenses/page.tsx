import { listExpenses } from "@/server/services/expenses";
import { listCategories } from "@/server/services/expense-categories";
import { listProjects } from "@/server/services/projects";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseList } from "./expense-list";

export default async function ExpensesPage() {
  const [expenses, categories, projects] = await Promise.all([
    listExpenses().catch(() => []),
    listCategories().catch(() => []),
    listProjects().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gastos" title="Gastos" description="" meta={null} />
      <ExpenseList
        initial={JSON.parse(JSON.stringify(expenses))}
        categories={JSON.parse(JSON.stringify(categories))}
        projects={JSON.parse(JSON.stringify(projects.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))}
      />
    </div>
  );
}
