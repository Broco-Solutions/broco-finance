"use client";

import { Pencil, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { isBefore, parseISO, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import type {
  ContractFrequency,
  ExpenseCategoryRecord,
  ExpenseRecord,
  ProjectRecord,
  RecurringExpenseRecord,
  ScheduledExpenseRecord,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatArs, formatShortDate, formatUsd } from "@/lib/utils";
import { ExpenseEntryModal } from "@/components/calendar/expense-entry-modal";
import { PayScheduledExpenseModal } from "@/components/expenses/pay-scheduled-expense-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { DataTable } from "@/components/ui/data-table";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TabKey = "ledger" | "recurring";
type LedgerStatus = "paid" | "pending" | "overdue";

type LedgerRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  date: string;
  description: string;
  expenseType: "fixed" | "variable";
  kind: "actual" | "scheduled";
  projectName: string | null;
  amountArs: number | null;
  amountUsd: number;
  status: LedgerStatus;
  expense: ExpenseRecord | null;
  scheduledExpense: ScheduledExpenseRecord | null;
};

const tabLabels: Record<TabKey, { eyebrow: string; title: string; description: string }> = {
  ledger: {
    eyebrow: "Gastos",
    title: "Egresos reales y compromisos del mes, sin mezclar caja con promesas",
    description:
      "Los gastos pagados ya impactan el resultado. Los recurrentes pendientes funcionan como recordatorios operativos hasta registrar el pago real.",
  },
  recurring: {
    eyebrow: "Recurrentes",
    title: "Plantillas vivas para costos fijos mensuales",
    description:
      "Cada plantilla genera 12 vencimientos hacia adelante. Al desactivarla desaparecen sus pendientes abiertos y el histórico pagado queda intacto.",
  },
};

const frequencyLabels: Record<ContractFrequency, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  biannual: "Semestral",
  annual: "Anual",
};

function isOverdueExpense(date: string) {
  return isBefore(parseISO(date), startOfDay(new Date()));
}

function statusBadge(status: LedgerStatus) {
  if (status === "paid") {
    return <Badge tone="success">Pagado</Badge>;
  }

  if (status === "overdue") {
    return <Badge tone="danger">Vencido</Badge>;
  }

  return <Badge tone="warning">Pendiente</Badge>;
}

function tabButtonClass(active: boolean) {
  return active
    ? "border-ink bg-ink text-paper shadow-[0_10px_24px_rgba(16,21,34,0.14)]"
    : "border-black/10 bg-white/80 text-ink hover:bg-black/5";
}

function actionButtonClass(tone: "neutral" | "danger" = "neutral") {
  return tone === "danger"
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brick/15 bg-brick/5 text-brick transition hover:bg-brick/10"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5";
}

function getExpenseLockedReason(expense: ExpenseRecord) {
  if (expense.salaryWithdrawalId) {
    return "Los gastos creados por salarios se editan desde distribución.";
  }

  if (expense.scheduledExpenseId) {
    return "Los gastos creados desde recurrentes se editan desde el pago programado.";
  }

  return null;
}

export function ExpensesScreen({
  expenses,
  categories,
  projects,
  recurringExpenses,
  scheduledExpenses,
  demoMode,
}: {
  expenses: ExpenseRecord[];
  categories: ExpenseCategoryRecord[];
  projects: ProjectRecord[];
  recurringExpenses: RecurringExpenseRecord[];
  scheduledExpenses: ScheduledExpenseRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("ledger");
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryRecord | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategoryRecord | null>(null);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [payableExpense, setPayableExpense] = useState<ScheduledExpenseRecord | null>(null);
  const [expenseEditor, setExpenseEditor] = useState<{ expense: ExpenseRecord; lockedReason: string | null } | null>(null);
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
  const [recurringForm, setRecurringForm] = useState({
    description: "",
    categoryId: categories[0]?.id ?? "",
    amountUsd: "",
    frequency: "monthly" as ContractFrequency,
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        description: string;
        categoryId: string;
        amountUsd: string;
        frequency: ContractFrequency;
        startDate: string;
        isActive: boolean;
      }
    >
  >(() =>
    Object.fromEntries(
      recurringExpenses.map((item) => [
        item.id,
        {
          description: item.description,
          categoryId: item.categoryId,
          amountUsd: String(item.amountUsd),
          frequency: item.frequency,
          startDate: item.startDate,
          isActive: item.isActive,
        },
      ]),
    ),
  );

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        recurringExpenses.map((item) => [
          item.id,
          {
            description: item.description,
            categoryId: item.categoryId,
            amountUsd: String(item.amountUsd),
            frequency: item.frequency,
            startDate: item.startDate,
            isActive: item.isActive,
          },
        ]),
      ),
    );
  }, [recurringExpenses]);

  const ledgerRows = useMemo<LedgerRow[]>(
    () => [
      ...scheduledExpenses.map<LedgerRow>((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        date: item.dueDate,
        description: item.description,
        expenseType: "fixed",
        kind: "scheduled",
        projectName: null,
        amountArs: null,
        amountUsd: item.amountUsd,
        status: isOverdueExpense(item.dueDate) ? "overdue" : "pending",
        expense: null,
        scheduledExpense: item,
      })),
      ...expenses.map<LedgerRow>((expense) => ({
        id: expense.id,
        categoryId: expense.categoryId,
        categoryName: expense.categoryName,
        date: expense.date,
        description: expense.description,
        expenseType: expense.expenseType,
        kind: "actual",
        projectName: expense.projectName,
        amountArs: expense.amountArs,
        amountUsd: expense.amountUsd,
        status: "paid",
        expense,
        scheduledExpense: null,
      })),
    ],
    [expenses, scheduledExpenses],
  );

  const visibleLedgerRows = useMemo(() => {
    const filtered = ledgerRows.filter((row) => {
      if (typeFilter && row.expenseType !== typeFilter) {
        return false;
      }
      if (categoryFilter && row.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter && row.status !== statusFilter) {
        return false;
      }
      return true;
    });

    return filtered.sort((left, right) => {
      const priority = { overdue: 0, pending: 1, paid: 2 };
      if (priority[left.status] !== priority[right.status]) {
        return priority[left.status] - priority[right.status];
      }

      const leftTime = parseISO(left.date).getTime();
      const rightTime = parseISO(right.date).getTime();

      if (left.status === "paid" && right.status === "paid") {
        return rightTime - leftTime;
      }

      return leftTime - rightTime;
    });
  }, [categoryFilter, ledgerRows, statusFilter, typeFilter]);

  const ledgerTotals = useMemo(
    () => ({
      count: visibleLedgerRows.length,
      actualUsd: visibleLedgerRows
        .filter((row) => row.status === "paid")
        .reduce((sum, row) => sum + row.amountUsd, 0),
      actualArs: visibleLedgerRows
        .filter((row) => row.status === "paid")
        .reduce((sum, row) => sum + (row.amountArs ?? 0), 0),
      pendingUsd: visibleLedgerRows
        .filter((row) => row.status === "pending" || row.status === "overdue")
        .reduce((sum, row) => sum + row.amountUsd, 0),
      overdueUsd: visibleLedgerRows
        .filter((row) => row.status === "overdue")
        .reduce((sum, row) => sum + row.amountUsd, 0),
    }),
    [visibleLedgerRows],
  );

  const recurringSummary = useMemo(
    () => ({
      activeCount: recurringExpenses.filter((item) => item.isActive).length,
      pendingCount: recurringExpenses.reduce((sum, item) => sum + item.pendingCount, 0),
      activeUsd: recurringExpenses.filter((item) => item.isActive).reduce((sum, item) => sum + item.amountUsd, 0),
    }),
    [recurringExpenses],
  );

  const categorySummary = useMemo(() => {
    const expenseUsage = expenses.reduce<Record<string, number>>((acc, item) => {
      acc[item.categoryId] = (acc[item.categoryId] ?? 0) + 1;
      return acc;
    }, {});
    const recurringUsage = recurringExpenses.reduce<Record<string, number>>((acc, item) => {
      acc[item.categoryId] = (acc[item.categoryId] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: categories.length,
      custom: categories.filter((category) => !category.isDefault).length,
      default: categories.filter((category) => category.isDefault).length,
      usageByCategory: categories.reduce<Record<string, number>>((acc, category) => {
        acc[category.id] = (expenseUsage[category.id] ?? 0) + (recurringUsage[category.id] ?? 0);
        return acc;
      }, {}),
    };
  }, [categories, expenses, recurringExpenses]);

  const handleExpenseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        setBusyTarget("expense:new");
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
        setForm((prev) => ({
          ...prev,
          description: "",
          amountUsd: "",
          amountArs: "",
          exchangeRate: "",
          notes: "",
        }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el gasto.");
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const handleCategorySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setCategoryError(null);
        setBusyTarget("category:new");
        const createdCategory = await apiFetch<ExpenseCategoryRecord>("/api/expense-categories", {
          method: "POST",
          body: JSON.stringify({
            name: categoryName,
          }),
        });
        setCategoryName("");
        setForm((prev) => ({ ...prev, categoryId: createdCategory.id }));
        setRecurringForm((prev) => ({ ...prev, categoryId: createdCategory.id }));
        router.refresh();
      } catch (submitError) {
        setCategoryError(submitError instanceof Error ? submitError.message : "No se pudo crear la categoría.");
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const openEditCategoryModal = (category: ExpenseCategoryRecord) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryError(null);
  };

  const closeEditCategoryModal = () => {
    setEditingCategory(null);
    setEditCategoryName("");
    setEditCategoryError(null);
  };

  const handleEditCategorySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCategory) {
      return;
    }

    startTransition(async () => {
      try {
        setEditCategoryError(null);
        setBusyTarget(`category:edit:${editingCategory.id}`);
        await apiFetch(`/api/expense-categories/${editingCategory.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: editCategoryName,
          }),
        });
        closeEditCategoryModal();
        router.refresh();
      } catch (submitError) {
        setEditCategoryError(
          submitError instanceof Error ? submitError.message : "No se pudo actualizar la categoría.",
        );
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const openDeleteCategoryModal = (category: ExpenseCategoryRecord) => {
    setDeletingCategory(category);
    setDeleteCategoryError(null);
  };

  const closeDeleteCategoryModal = () => {
    setDeletingCategory(null);
    setDeleteCategoryError(null);
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteCategoryError(null);
        setBusyTarget(`category:delete:${deletingCategory.id}`);
        await apiFetch(`/api/expense-categories/${deletingCategory.id}`, {
          method: "DELETE",
        });
        if (form.categoryId === deletingCategory.id) {
          setForm((prev) => ({ ...prev, categoryId: categories.find((item) => item.id !== deletingCategory.id)?.id ?? "" }));
        }
        if (recurringForm.categoryId === deletingCategory.id) {
          setRecurringForm((prev) => ({
            ...prev,
            categoryId: categories.find((item) => item.id !== deletingCategory.id)?.id ?? "",
          }));
        }
        if (categoryFilter === deletingCategory.id) {
          setCategoryFilter("");
        }
        closeDeleteCategoryModal();
        router.refresh();
      } catch (submitError) {
        setDeleteCategoryError(
          submitError instanceof Error ? submitError.message : "No se pudo eliminar la categoría.",
        );
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const handleRecurringSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setRecurringError(null);
        setBusyTarget("recurring:new");
        await apiFetch("/api/recurring-expenses", {
          method: "POST",
          body: JSON.stringify({
            description: recurringForm.description,
            categoryId: recurringForm.categoryId,
            amountUsd: Number(recurringForm.amountUsd),
            frequency: recurringForm.frequency,
            startDate: recurringForm.startDate,
          }),
        });
        setRecurringForm((prev) => ({
          ...prev,
          description: "",
          amountUsd: "",
        }));
        router.refresh();
      } catch (submitError) {
        setRecurringError(
          submitError instanceof Error ? submitError.message : "No se pudo crear el gasto recurrente.",
        );
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const saveRecurringExpense = (item: RecurringExpenseRecord) => {
    const draft = drafts[item.id];
    if (!draft) {
      return;
    }

    startTransition(async () => {
      try {
        setTemplateError(null);
        setBusyTarget(item.id);
        await apiFetch(`/api/recurring-expenses/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({
            description: draft.description,
            categoryId: draft.categoryId,
            amountUsd: Number(draft.amountUsd),
            frequency: draft.frequency,
            startDate: draft.startDate,
            isActive: draft.isActive,
            updatePendingExpenses: true,
          }),
        });
        router.refresh();
      } catch (submitError) {
        setTemplateError(
          submitError instanceof Error ? submitError.message : "No se pudo actualizar la plantilla recurrente.",
        );
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const header = tabLabels[activeTab];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={header.eyebrow}
        title={activeTab === "ledger" ? "Gastos" : "Recurrentes"}
        description=""
        demoMode={demoMode}
      />

      <div className="flex flex-wrap gap-3">
        <button
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${tabButtonClass(activeTab === "ledger")}`}
          onClick={() => setActiveTab("ledger")}
          type="button"
        >
          Gastos
        </button>
        <button
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${tabButtonClass(activeTab === "recurring")}`}
          onClick={() => setActiveTab("recurring")}
          type="button"
        >
          Recurrentes
        </button>
      </div>

      {activeTab === "ledger" ? (
        <div className="space-y-6">
          <Card>
            <div className="grid gap-6 xl:grid-cols-[0.95fr,1.25fr]">
              <form className="space-y-4" onSubmit={handleCategorySubmit}>
                <div>
                  <h2 className="font-display text-2xl text-ink">Categorías de gastos</h2>
                  <p className="mt-1 text-sm text-ink/55">
                    Ordená el mapa de egresos antes de cargar movimientos. Crear, editar o depurar categorías vive acá.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-black/10 bg-white/75 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Total</div>
                    <div className="mt-1 font-display text-2xl text-ink">{categorySummary.total}</div>
                  </div>
                  <div className="rounded-[1rem] border border-black/10 bg-white/75 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Base</div>
                    <div className="mt-1 font-display text-2xl text-cobalt">{categorySummary.default}</div>
                  </div>
                  <div className="rounded-[1rem] border border-black/10 bg-white/75 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Custom</div>
                    <div className="mt-1 font-display text-2xl text-emerald-950">{categorySummary.custom}</div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(238,247,255,0.88))] p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nueva categoría</label>
                  <Input
                    className="mt-3"
                    placeholder="Ej: Licencias IA, Honorarios legales"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                  />
                  <p className="mt-3 text-xs text-ink/55">
                    Va a quedar disponible tanto para gastos reales como para plantillas recurrentes.
                  </p>
                </div>

                {categoryError ? <p className="text-sm text-brick">{categoryError}</p> : null}

                <Button type="submit" disabled={isPending || demoMode || categoryName.trim().length < 2}>
                  {demoMode ? "Requiere DATABASE_URL" : isPending && busyTarget === "category:new" ? "Guardando…" : "Crear categoría"}
                </Button>
              </form>

              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-2xl text-ink">Catálogo activo</h3>
                  <p className="mt-1 text-sm text-ink/55">
                    Editá nombres al vuelo y eliminá solo categorías sin uso. Las que ya tienen movimientos quedan protegidas.
                  </p>
                </div>

                {categories.length === 0 ? (
                  <EmptyState
                    title="Sin categorías"
                    description="Creá la primera categoría para empezar a clasificar egresos."
                  />
                ) : (
                  <DataTable headers={["Categoría", "Origen", "Uso", "Acciones"]} scrollAfter={6} maxHeightClassName="max-h-[22rem]">
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{category.name}</div>
                          <div className="text-xs uppercase tracking-[0.16em] text-ink/45">ID corto · {category.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={category.isDefault ? "neutral" : "success"}>
                            {category.isDefault ? "Base" : "Custom"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{categorySummary.usageByCategory[category.id] ?? 0}</div>
                          <div className="text-xs text-ink/55">gastos o plantillas</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              aria-label={`Editar ${category.name}`}
                              className={actionButtonClass()}
                              onClick={() => openEditCategoryModal(category)}
                              title="Editar categoría"
                              type="button"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Eliminar ${category.name}`}
                              className={actionButtonClass("danger")}
                              onClick={() => openDeleteCategoryModal(category)}
                              title="Eliminar categoría"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <form className="space-y-4" onSubmit={handleExpenseSubmit}>
              <div>
                <h2 className="font-display text-2xl text-ink">Nuevo gasto real</h2>
                <p className="mt-1 text-sm text-ink/55">Usalo cuando el dinero ya salió. Si todavía es un compromiso mensual, cargalo como plantilla recurrente.</p>
              </div>
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
              <Input
                placeholder="Descripción"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  min="0"
                  placeholder="Monto USD"
                  type="number"
                  value={form.amountUsd}
                  onChange={(event) => setForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
                />
                <Input
                  min="0"
                  placeholder="Monto ARS"
                  type="number"
                  value={form.amountArs}
                  onChange={(event) => setForm((prev) => ({ ...prev, amountArs: event.target.value }))}
                />
                <Input
                  min="0"
                  placeholder="TC"
                  type="number"
                  value={form.exchangeRate}
                  onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
                />
              </div>
              <Textarea placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
              {error ? <p className="text-sm text-brick">{error}</p> : null}
              <Button type="submit" disabled={isPending || demoMode}>
                {demoMode ? "Requiere DATABASE_URL" : isPending && busyTarget === "expense:new" ? "Guardando…" : "Registrar gasto"}
              </Button>
            </form>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-ink">Caja egresada + compromisos abiertos</h2>
                <p className="mt-1 text-sm text-ink/55">La tabla prioriza vencidos y pendientes del mes antes del histórico pagado.</p>
              </div>
              <div className="grid w-full gap-3 md:max-w-3xl md:grid-cols-3">
                <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">Todos los tipos</option>
                  <option value="fixed">fixed</option>
                  <option value="variable">variable</option>
                </Select>
                <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente</option>
                  <option value="overdue">Vencido</option>
                </Select>
              </div>
            </div>

            <div className="mb-4 grid gap-3 rounded-[1.2rem] border border-amber-900/10 bg-[linear-gradient(120deg,rgba(255,251,235,0.98),rgba(255,255,255,0.92),rgba(255,241,242,0.95))] px-4 py-4 md:grid-cols-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Total filtrado</div>
                <div className="mt-1 text-sm text-ink/65">{ledgerTotals.count} movimientos visibles</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Real ARS</div>
                <div className="mt-1 font-semibold text-ink">{formatArs(ledgerTotals.actualArs)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Real USD</div>
                <div className="mt-1 font-display text-2xl text-rose-950">{formatUsd(ledgerTotals.actualUsd)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Comprometido visible</div>
                <div className="mt-1 font-display text-2xl text-amber-950">{formatUsd(ledgerTotals.pendingUsd)}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-brick/75">Vencido {formatUsd(ledgerTotals.overdueUsd)}</div>
              </div>
            </div>

            {visibleLedgerRows.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
                description="Probá otra combinación de filtros o cargá gastos recurrentes para ver recordatorios de pago en esta vista."
              />
            ) : (
              <DataTable
                tableClassName="min-w-[72rem] table-fixed"
                colGroup={
                  <colgroup>
                    <col className="w-[7.5rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[18rem]" />
                    <col className="w-[11rem]" />
                    <col className="w-[8.5rem]" />
                    <col className="w-[8.5rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[7.5rem]" />
                    <col className="w-[8rem]" />
                  </colgroup>
                }
                footer={
                  <tr>
                    <td className="px-4 py-3 font-semibold text-ink" colSpan={4}>
                      Total filtrado
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatArs(ledgerTotals.actualArs)}</td>
                    <td className="px-4 py-3 font-semibold text-rose-950">{formatUsd(ledgerTotals.actualUsd)}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/55">
                      Comprometido {formatUsd(ledgerTotals.pendingUsd)}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-brick/80">
                      Vencido {formatUsd(ledgerTotals.overdueUsd)}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/45">{ledgerTotals.count} filas</td>
                  </tr>
                }
                headers={["Fecha", "Categoría", "Descripción", "Proyecto", "ARS", "USD", "Tipo", "Estado", "Acción"]}
              >
                {visibleLedgerRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatShortDate(row.date)}</td>
                    <td className="px-4 py-3">{row.categoryName}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{row.description}</div>
                    </td>
                    <td className="px-4 py-3">{row.projectName ?? "Operativo"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatArs(row.amountArs)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatUsd(row.amountUsd)}</td>
                    <td className="px-4 py-3 whitespace-nowrap uppercase">{row.expenseType}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.kind === "scheduled" && row.scheduledExpense ? (
                        <Button
                          type="button"
                          variant={row.status === "overdue" ? "primary" : "secondary"}
                          className="px-3 py-1.5 text-xs"
                          disabled={demoMode}
                          onClick={() => setPayableExpense(row.scheduledExpense)}
                        >
                          {demoMode ? "Demo" : "Pagar ahora"}
                        </Button>
                      ) : row.expense ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          disabled={demoMode}
                          onClick={() =>
                            setExpenseEditor({
                              expense: row.expense!,
                              lockedReason: getExpenseLockedReason(row.expense!),
                            })
                          }
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Editar
                        </Button>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.16em] text-ink/35">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <form className="space-y-4" onSubmit={handleRecurringSubmit}>
              <div>
                <h2 className="font-display text-2xl text-ink">Nueva plantilla recurrente</h2>
                <p className="mt-1 text-sm text-ink/55">Ideal para SaaS, impuestos, contabilidad y cualquier costo fijo que querés predecir antes de pagarlo.</p>
              </div>
              <Select value={recurringForm.categoryId} onChange={(event) => setRecurringForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Descripción"
                value={recurringForm.description}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  min="0"
                  placeholder="Monto USD"
                  type="number"
                  value={recurringForm.amountUsd}
                  onChange={(event) => setRecurringForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
                />
                <Select value={recurringForm.frequency} onChange={(event) => setRecurringForm((prev) => ({ ...prev, frequency: event.target.value as ContractFrequency }))}>
                  <option value="monthly">monthly</option>
                  <option value="quarterly">quarterly</option>
                  <option value="biannual">biannual</option>
                  <option value="annual">annual</option>
                </Select>
              </div>
              <Input
                type="date"
                value={recurringForm.startDate}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
              {recurringError ? <p className="text-sm text-brick">{recurringError}</p> : null}
              <Button type="submit" disabled={isPending || demoMode}>
                {demoMode ? "Requiere DATABASE_URL" : isPending && busyTarget === "recurring:new" ? "Guardando…" : "Crear plantilla"}
              </Button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-ink">Plantillas activas</h2>
                  <p className="mt-1 text-sm text-ink/55">Cambiar el monto o la frecuencia actualiza solo pendientes futuros. Lo pagado no se reescribe.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-black/10 bg-white/75 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Activas</div>
                    <div className="mt-1 font-display text-2xl text-ink">{recurringSummary.activeCount}</div>
                  </div>
                  <div className="rounded-[1rem] border border-black/10 bg-white/75 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Pendientes</div>
                    <div className="mt-1 font-display text-2xl text-ink">{recurringSummary.pendingCount}</div>
                  </div>
                  <div className="rounded-[1rem] border border-black/10 bg-white/75 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Compromiso base</div>
                    <div className="mt-1 font-display text-2xl text-amber-950">{formatUsd(recurringSummary.activeUsd)}</div>
                  </div>
                </div>
              </div>

              {templateError ? <p className="mb-4 text-sm text-brick">{templateError}</p> : null}

              {recurringExpenses.length === 0 ? (
                <EmptyState
                  title="Sin plantillas recurrentes"
                  description="Creá la primera para que la app empiece a generar gastos pendientes automáticamente."
                />
              ) : (
                <div className="space-y-4">
                  {recurringExpenses.map((item) => {
                    const draft = drafts[item.id];
                    if (!draft) {
                      return null;
                    }

                    return (
                      <div
                        key={item.id}
                        className="rounded-[1.35rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.93),rgba(248,250,252,0.88))] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                              {item.categoryName}
                            </div>
                            <div className="mt-1 text-lg font-semibold text-ink">{draft.description}</div>
                            <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink/60">
                              <span>Próximo: {formatShortDate(item.nextDueDate)}</span>
                              <span>{item.pendingCount} pendientes</span>
                              <span>{draft.isActive ? "Activo" : "Inactivo"}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                              {frequencyLabels[draft.frequency]}
                            </div>
                            <div className="mt-1 font-display text-3xl text-ink">{formatUsd(Number(draft.amountUsd || 0))}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr,0.9fr,0.7fr,0.8fr,auto,auto]">
                          <Input
                            placeholder="Descripción"
                            value={draft.description}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  description: event.target.value,
                                },
                              }))
                            }
                          />
                          <Select
                            value={draft.categoryId}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  categoryId: event.target.value,
                                },
                              }))
                            }
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                          <Input
                            min="0"
                            placeholder="Monto USD"
                            type="number"
                            value={draft.amountUsd}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  amountUsd: event.target.value,
                                },
                              }))
                            }
                          />
                          <Select
                            value={draft.frequency}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  frequency: event.target.value as ContractFrequency,
                                },
                              }))
                            }
                          >
                            <option value="monthly">monthly</option>
                            <option value="quarterly">quarterly</option>
                            <option value="biannual">biannual</option>
                            <option value="annual">annual</option>
                          </Select>
                          <Input
                            type="date"
                            value={draft.startDate}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  startDate: event.target.value,
                                },
                              }))
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={draft.isActive ? "secondary" : "ghost"}
                              onClick={() =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    isActive: !draft.isActive,
                                  },
                                }))
                              }
                            >
                              {draft.isActive ? "Activo" : "Inactivo"}
                            </Button>
                            <Button
                              type="button"
                              disabled={isPending || demoMode}
                              onClick={() => saveRecurringExpense(item)}
                            >
                              {demoMode ? "Demo" : isPending && busyTarget === item.id ? "Guardando…" : "Guardar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <PayScheduledExpenseModal
        demoMode={demoMode}
        open={Boolean(payableExpense)}
        scheduledExpense={payableExpense}
        onClose={() => setPayableExpense(null)}
      />

      <ExpenseEntryModal
        categories={categories}
        date={expenseEditor?.expense.date ?? new Date().toISOString().slice(0, 10)}
        description="Corregí el gasto real y el cambio impacta en los listados, resúmenes y métricas financieras."
        demoMode={demoMode}
        expense={expenseEditor?.expense ?? null}
        lockedReason={expenseEditor?.lockedReason ?? null}
        open={Boolean(expenseEditor)}
        projects={projects}
        onClose={() => setExpenseEditor(null)}
      />

      <EditEntityModal
        open={Boolean(editingCategory)}
        title="Editar categoría"
        description="Renombrá la categoría sin tocar el histórico. Todos los gastos asociados seguirán apuntando a la misma categoría."
        submitLabel="Guardar categoría"
        isPending={isPending}
        disabled={demoMode}
        error={editCategoryError}
        onClose={closeEditCategoryModal}
        onSubmit={handleEditCategorySubmit}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre</label>
            <Input value={editCategoryName} onChange={(event) => setEditCategoryName(event.target.value)} />
          </div>
          {demoMode ? <p className="text-sm text-ink/55">La edición persistente requiere `DATABASE_URL`.</p> : null}
        </div>
      </EditEntityModal>

      <ConfirmActionModal
        open={Boolean(deletingCategory)}
        title="Eliminar categoría"
        description="La categoría solo puede eliminarse si no tiene gastos reales ni plantillas recurrentes vinculadas."
        confirmLabel="Eliminar categoría"
        isPending={isPending}
        disabled={demoMode}
        error={deleteCategoryError}
        onClose={closeDeleteCategoryModal}
        onConfirm={handleDeleteCategory}
      >
        {deletingCategory ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Categoría: <span className="font-semibold text-ink">{deletingCategory.name}</span>.
            </p>
            <p>
              Uso detectado: <span className="font-semibold text-ink">{categorySummary.usageByCategory[deletingCategory.id] ?? 0}</span> movimiento(s) o plantilla(s).
            </p>
            {deletingCategory.isDefault ? (
              <p className="text-ink/60">Es una categoría base del sistema, pero igual puede eliminarse si no está en uso.</p>
            ) : (
              <p className="text-ink/60">Si no tiene referencias, la baja se va a ejecutar de forma definitiva.</p>
            )}
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
