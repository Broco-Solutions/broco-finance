"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategoryRecord, ExpenseRecord, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatArs, formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ExpensesScreen({
  expenses,
  categories,
  projects,
  demoMode,
}: {
  expenses: ExpenseRecord[];
  categories: ExpenseCategoryRecord[];
  projects: ProjectRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    categoryId: categories[0]?.id ?? "",
    expenseType: "fixed",
    projectId: "",
    description: "",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  });

  const visibleExpenses = useMemo(
    () => (typeFilter ? expenses.filter((expense) => expense.expenseType === typeFilter) : expenses),
    [expenses, typeFilter],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/expenses", {
          method: "POST",
          body: JSON.stringify({
            date: form.date,
            categoryId: form.categoryId,
            expenseType: form.expenseType,
            projectId: form.projectId || null,
            description: form.description,
            amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
            amountArs: form.amountArs ? Number(form.amountArs) : null,
            exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
            notes: form.notes || null,
          }),
        });
        setForm((prev) => ({ ...prev, description: "", amountUsd: "", amountArs: "", exchangeRate: "", notes: "" }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el gasto.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Gastos"
        title="Egresos fijos, variables y salarios reconciliados"
        description="Los retiros de sueldo viven acá como gastos automáticos. Si nacen desde distribución, no se editan desde esta vista."
        demoMode={demoMode}
      />
      <div className="grid gap-6 xl:grid-cols-[0.86fr,1.14fr]">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <h2 className="font-display text-2xl text-ink">Nuevo gasto</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
              <Select value={form.expenseType} onChange={(event) => setForm((prev) => ({ ...prev, expenseType: event.target.value }))}>
                <option value="fixed">fixed</option>
                <option value="variable">variable</option>
              </Select>
            </div>
            <Select value={form.categoryId} onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              <option value="">Sin proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Descripción" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="number"
                min="0"
                placeholder="Monto USD"
                value={form.amountUsd}
                onChange={(event) => setForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
              />
              <Input
                type="number"
                min="0"
                placeholder="Monto ARS"
                value={form.amountArs}
                onChange={(event) => setForm((prev) => ({ ...prev, amountArs: event.target.value }))}
              />
              <Input
                type="number"
                min="0"
                placeholder="TC"
                value={form.exchangeRate}
                onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
              />
            </div>
            <Textarea placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Registrar gasto"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Historial de gastos</h2>
              <p className="mt-1 text-sm text-ink/55">Separá fijos y variables para leer mejor el neto del período.</p>
            </div>
            <Select className="max-w-[220px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="fixed">fixed</option>
              <option value="variable">variable</option>
            </Select>
          </div>
          <DataTable headers={["Fecha", "Categoría", "Descripción", "Proyecto", "ARS", "USD", "Tipo"]}>
            {visibleExpenses.map((expense) => (
              <tr key={expense.id}>
                <td className="px-4 py-3">{formatShortDate(expense.date)}</td>
                <td className="px-4 py-3">{expense.categoryName}</td>
                <td className="px-4 py-3">{expense.description}</td>
                <td className="px-4 py-3">{expense.projectName ?? "—"}</td>
                <td className="px-4 py-3">{formatArs(expense.amountArs)}</td>
                <td className="px-4 py-3">{formatUsd(expense.amountUsd)}</td>
                <td className="px-4 py-3 uppercase">{expense.expenseType}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
