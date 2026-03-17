"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategoryRecord, ExpenseRecord, ExpenseType, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ExpenseFormState = {
  amountArs: string;
  amountUsd: string;
  categoryId: string;
  date: string;
  description: string;
  exchangeRate: string;
  expenseType: ExpenseType;
  notes: string;
  projectId: string;
};

function buildExpenseForm({
  date,
  expense,
  categories,
}: {
  date: string;
  expense: ExpenseRecord | null;
  categories: ExpenseCategoryRecord[];
}): ExpenseFormState {
  if (expense) {
    return {
      date: expense.date,
      categoryId: expense.categoryId,
      expenseType: expense.expenseType,
      projectId: expense.projectId ?? "",
      description: expense.description,
      amountUsd: expense.amountUsd ? String(expense.amountUsd) : "",
      amountArs: expense.amountArs ? String(expense.amountArs) : "",
      exchangeRate: expense.exchangeRate ? String(expense.exchangeRate) : "",
      notes: expense.notes ?? "",
    };
  }

  return {
    date,
    categoryId: categories[0]?.id ?? "",
    expenseType: "fixed",
    projectId: "",
    description: "",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  };
}

export function ExpenseEntryModal({
  categories,
  date,
  demoMode,
  expense,
  lockedReason,
  onClose,
  open,
  projects,
}: {
  categories: ExpenseCategoryRecord[];
  date: string;
  demoMode: boolean;
  expense: ExpenseRecord | null;
  lockedReason?: string | null;
  onClose: () => void;
  open: boolean;
  projects: ProjectRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(() => buildExpenseForm({ expense, date, categories }));
  const lockedExpense = Boolean(lockedReason || expense?.salaryWithdrawalId || expense?.scheduledExpenseId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setForm(buildExpenseForm({ expense, date, categories }));
  }, [categories, date, expense, open]);

  const submitDisabled = demoMode || isPending || lockedExpense || !form.categoryId || categories.length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(expense ? `/api/expenses/${expense.id}` : "/api/expenses", {
          method: expense ? "PUT" : "POST",
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
        onClose();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el gasto.");
      }
    });
  };

  return (
    <EditEntityModal
      open={open}
      title={expense ? "Editar gasto" : "Nuevo gasto"}
      description={
        expense
          ? "Ajustá el egreso real directamente desde el calendario."
          : "Registrá un gasto con la fecha del día elegido y dejalo integrado al ledger."
      }
      submitLabel={expense ? "Guardar gasto" : "Crear gasto"}
      isPending={isPending}
      disabled={submitDisabled}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha</label>
            <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Tipo</label>
            <Select value={form.expenseType} onChange={(event) => setForm((prev) => ({ ...prev, expenseType: event.target.value as ExpenseType }))}>
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Categoría</label>
          <Select value={form.categoryId} onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
            {categories.length === 0 ? <option value="">Sin categorías disponibles</option> : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
          <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
            <option value="">Sin proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.clientName} · {project.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Descripción</label>
          <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto USD</label>
            <Input
              min="0"
              placeholder="0.00"
              type="number"
              value={form.amountUsd}
              onChange={(event) => setForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto ARS</label>
            <Input
              min="0"
              placeholder="0"
              type="number"
              value={form.amountArs}
              onChange={(event) => setForm((prev) => ({ ...prev, amountArs: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">TC</label>
            <Input
              min="0"
              placeholder="0"
              type="number"
              value={form.exchangeRate}
              onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
          <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </div>

        {lockedExpense ? (
          <div className="rounded-[1.2rem] border border-black/10 bg-black/5 px-4 py-3 text-sm text-ink/70">
            {lockedReason ?? "Este gasto fue generado por otro flujo del sistema y no se edita desde acá."}
          </div>
        ) : null}

        {categories.length === 0 ? <p className="text-sm text-ink/55">Necesitás al menos una categoría para registrar gastos.</p> : null}

        {expense ? (
          <div className="flex justify-end border-t border-black/8 pt-4">
            <Button type="button" variant="ghost" disabled>
              Gasto real
            </Button>
          </div>
        ) : null}
      </div>
    </EditEntityModal>
  );
}
