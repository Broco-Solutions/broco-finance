"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategoryRecord, ExpenseRecord, ExpenseStatus, ExpenseType, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ExpenseFormState = {
  amountArs: string;
  amountUsd: string;
  categoryId: string;
  date: string;
  dueDate: string;
  description: string;
  exchangeRate: string;
  expenseType: ExpenseType;
  projectId: string;
  status: ExpenseStatus;
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
      dueDate: expense.dueDate ?? "",
      categoryId: expense.categoryId,
      expenseType: expense.expenseType,
      projectId: expense.projectId ?? "",
      status: expense.status,
      description: expense.description,
      amountUsd: expense.amountUsd ? String(expense.amountUsd) : "",
      amountArs: expense.amountArs ? String(expense.amountArs) : "",
      exchangeRate: expense.exchangeRate ? String(expense.exchangeRate) : "",
    };
  }

  return {
    date,
    dueDate: date,
    categoryId: categories[0]?.id ?? "",
    expenseType: "fixed",
    projectId: "",
    status: "PAID",
    description: "",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
  };
}

export function ExpenseEntryModal({
  categories,
  date,
  description,
  demoMode,
  expense,
  lockedReason,
  onClose,
  open,
  projects,
}: {
  categories: ExpenseCategoryRecord[];
  date: string;
  description?: string;
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(() => buildExpenseForm({ expense, date, categories }));
  const lockedExpense = Boolean(lockedReason || expense?.salaryWithdrawalId || expense?.scheduledExpenseId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setDeleteError(null);
    setDeleteDialogOpen(false);
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
            dueDate: expense ? (form.dueDate || null) : form.status === "PENDING" ? form.dueDate || null : null,
            status: form.status,
            categoryId: form.categoryId,
            expenseType: form.expenseType,
            projectId: form.projectId || null,
            description: form.description || null,
            amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
            amountArs: form.amountArs ? Number(form.amountArs) : null,
            exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
            notes: null,
          }),
        });
        onClose();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el gasto.");
      }
    });
  };

  const handleDelete = () => {
    if (!expense) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteError(null);
        await apiFetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
        setDeleteDialogOpen(false);
        onClose();
        router.refresh();
      } catch (submitError) {
        setDeleteError(submitError instanceof Error ? submitError.message : "No se pudo eliminar el gasto.");
      }
    });
  };

  return (
    <>
      <EditEntityModal
        open={open}
        title={expense ? "Editar gasto" : "Nuevo gasto"}
        description={
          description ?? (
            expense
              ? "Ajustá el movimiento operativo directamente desde el calendario."
              : "Registrá un gasto con la fecha elegida y definí si queda pagado o pendiente."
          )
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
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Temporalidad</label>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as ExpenseStatus,
                    dueDate: event.target.value === "PENDING" ? prev.dueDate || prev.date : prev.dueDate,
                  }))
                }
              >
                <option value="PAID">Inmediato</option>
                <option value="PENDING">Pendiente</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Tipo</label>
              <Select value={form.expenseType} onChange={(event) => setForm((prev) => ({ ...prev, expenseType: event.target.value as ExpenseType }))}>
                <option value="fixed">Fijo</option>
                <option value="variable">Variable</option>
              </Select>
            </div>
          </div>

          <div className={`grid gap-3 ${form.status === "PENDING" || (expense && form.dueDate) ? "sm:grid-cols-2" : ""}`}>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha</label>
              <Input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    date: event.target.value,
                    dueDate: prev.status === "PENDING" && !prev.dueDate ? event.target.value : prev.dueDate,
                  }))
                }
              />
            </div>
            {form.status === "PENDING" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Vence</label>
                <Input
                  required
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>
            ) : null}
            {form.status !== "PENDING" && expense && form.dueDate ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Corresponde a</label>
                <Input disabled type="date" value={form.dueDate} />
              </div>
            ) : null}
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
            <Input placeholder="Opcional" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
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

          {lockedExpense ? (
            <div className="rounded-[1.2rem] border border-black/10 bg-black/5 px-4 py-3 text-sm text-ink/70">
              {lockedReason ?? "Este gasto fue generado por otro flujo del sistema y no se edita desde acá."}
            </div>
          ) : null}

          {categories.length === 0 ? <p className="text-sm text-ink/55">Necesitás al menos una categoría para registrar gastos.</p> : null}

          {expense && !lockedExpense ? (
            <div className="flex justify-start border-t border-black/8 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="text-brick hover:bg-brick/10 hover:text-brick"
                disabled={demoMode || isPending}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDialogOpen(true);
                }}
              >
                Eliminar gasto
              </Button>
            </div>
          ) : null}
        </div>
      </EditEntityModal>

      <ConfirmActionModal
        open={deleteDialogOpen}
        title="Eliminar gasto"
        description="Esta acción borra el gasto real de forma definitiva y recalcula los totales, balances y resúmenes derivados."
        confirmLabel="Eliminar gasto"
        isPending={isPending}
        disabled={demoMode}
        error={deleteError}
        onClose={() => {
          setDeleteError(null);
          setDeleteDialogOpen(false);
        }}
        onConfirm={handleDelete}
      >
        {expense ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Gasto: <span className="font-semibold text-ink">{expense.description || expense.categoryName}</span>.
            </p>
            <p>
              Importe: <span className="font-semibold text-ink">{expense.amountUsd.toFixed(2)} USD</span>.
            </p>
            <p className="text-ink/60">Si el gasto proviene de salarios o de un flujo recurrente conciliado, el sistema va a bloquear la eliminación.</p>
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </>
  );
}
