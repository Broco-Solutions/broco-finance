"use client";

import { Pencil, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ExpenseCategoryRecord,
  ExpenseLedgerStatus,
  ExpenseRecord,
  ExpenseStatus,
  ExpenseType,
  ProjectRecord,
  RecurringExpenseRecord,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { cn, formatExpenseStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { ExpenseEntryModal } from "@/components/calendar/expense-entry-modal";
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

function statusChip(status: ExpenseLedgerStatus) {
  if (status === "PAID") {
    return "border-rose-950/18 bg-rose-50 text-rose-950";
  }

  if (status === "OVERDUE") {
    return "border-brick/20 bg-rose-50 text-brick";
  }

  return "border-amber-900/20 bg-amber-50 text-amber-950";
}

function statusRowClassName(status: ExpenseLedgerStatus) {
  if (status === "OVERDUE") {
    return "bg-rose-50/70";
  }

  if (status === "PENDING") {
    return "bg-amber-50/60";
  }

  return undefined;
}

function typeChip(type: ExpenseType) {
  return type === "fixed"
    ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
    : "border-rose-900/20 bg-rose-50 text-rose-950";
}

function actionButtonClass(tone: "neutral" | "danger" = "neutral") {
  return tone === "danger"
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brick/15 bg-brick/5 text-brick transition hover:bg-brick/10 active:scale-[0.97]"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5 active:scale-[0.97]";
}

function getExpenseLockedReason(expense: ExpenseRecord) {
  if (expense.salaryWithdrawalId) {
    return "Los gastos creados por salarios se editan desde distribución.";
  }

  if (expense.scheduledExpenseId) {
    return "Los gastos conciliados con recurrentes se editan desde ese flujo.";
  }

  return null;
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  activeToneClassName,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (nextValue: T) => void;
  activeToneClassName: string;
}) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</div>
      <div className="rounded-[1.4rem] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.68))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="relative grid grid-cols-2 gap-1">
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-[calc(50%-0.125rem)] rounded-[1rem] shadow-[0_14px_24px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out",
              activeToneClassName,
              activeIndex === 1 && "translate-x-[calc(100%+0.25rem)]",
            )}
          />
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "relative z-10 rounded-[1rem] px-4 py-3 text-left transition-colors duration-200",
                  selected ? "text-white" : "text-ink/72 hover:text-ink",
                )}
                onClick={() => onChange(option.value)}
              >
                <div className="text-sm font-semibold tracking-[0.01em]">{option.label}</div>
                {option.hint ? (
                  <div className={cn("mt-1 text-[11px] leading-4", selected ? "text-white/78" : "text-ink/46")}>{option.hint}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ExpenseFormState = {
  date: string;
  dueDate: string;
  status: ExpenseStatus;
  expenseType: ExpenseType;
  categoryId: string;
  projectId: string;
  description: string;
  amountUsd: string;
  amountArs: string;
  exchangeRate: string;
};

function buildEmptyForm(categories: ExpenseCategoryRecord[]): ExpenseFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "PAID",
    expenseType: "fixed",
    categoryId: categories[0]?.id ?? "",
    projectId: "",
    description: "",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
  };
}

const statusSegments: Array<{ value: ExpenseStatus; label: string; hint: string }> = [
  { value: "PAID", label: "Inmediato", hint: "Impacta hoy en caja" },
  { value: "PENDING", label: "Pendiente", hint: "Queda comprometido" },
];

const typeSegments: Array<{ value: ExpenseType; label: string; hint: string }> = [
  { value: "fixed", label: "Fijo", hint: "Costo operativo repetible" },
  { value: "variable", label: "Variable", hint: "Movimiento puntual o flexible" },
];

export function ExpensesScreen({
  expenses,
  categories,
  projects,
  recurringExpenses,
  demoMode,
}: {
  expenses: ExpenseRecord[];
  categories: ExpenseCategoryRecord[];
  projects: ProjectRecord[];
  recurringExpenses: RecurringExpenseRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<ExpenseLedgerStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ExpenseType | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryRecord | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategoryRecord | null>(null);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [expenseEditor, setExpenseEditor] = useState<{ expense: ExpenseRecord; lockedReason: string | null } | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(buildEmptyForm(categories));

  const visibleExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (statusFilter && expense.displayStatus !== statusFilter) {
          return false;
        }
        if (typeFilter && expense.expenseType !== typeFilter) {
          return false;
        }
        if (categoryFilter && expense.categoryId !== categoryFilter) {
          return false;
        }
        return true;
      }),
    [categoryFilter, expenses, statusFilter, typeFilter],
  );

  const summary = useMemo(
    () => ({
      paidUsd: expenses.filter((expense) => expense.displayStatus === "PAID").reduce((sum, expense) => sum + expense.amountUsd, 0),
      openUsd: expenses.filter((expense) => expense.displayStatus !== "PAID").reduce((sum, expense) => sum + expense.amountUsd, 0),
      fixedPaidUsd: expenses
        .filter((expense) => expense.displayStatus === "PAID" && expense.expenseType === "fixed")
        .reduce((sum, expense) => sum + expense.amountUsd, 0),
      variablePaidUsd: expenses
        .filter((expense) => expense.displayStatus === "PAID" && expense.expenseType === "variable")
        .reduce((sum, expense) => sum + expense.amountUsd, 0),
    }),
    [expenses],
  );

  const filteredTotals = useMemo(
    () => ({
      count: visibleExpenses.length,
      amountUsd: visibleExpenses.reduce((sum, expense) => sum + expense.amountUsd, 0),
    }),
    [visibleExpenses],
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
            dueDate: form.status === "PENDING" ? form.dueDate || null : null,
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
        setForm(buildEmptyForm(categories));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el gasto.");
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const handleMarkPaid = (expense: ExpenseRecord) => {
    startTransition(async () => {
      try {
        setError(null);
        setBusyTarget(`expense:paid:${expense.id}`);
        await apiFetch(`/api/expenses/${expense.id}`, {
          method: "PUT",
          body: JSON.stringify({
            date: new Date().toISOString().slice(0, 10),
            dueDate: expense.dueDate,
            status: "PAID",
            categoryId: expense.categoryId,
            expenseType: expense.expenseType,
            projectId: expense.projectId,
            description: expense.description || null,
            amountUsd: expense.amountUsd,
            amountArs: expense.amountArs,
            exchangeRate: expense.exchangeRate,
            notes: null,
          }),
        });
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el pago.");
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
          body: JSON.stringify({ name: categoryName }),
        });
        setCategoryName("");
        setForm((prev) => ({ ...prev, categoryId: createdCategory.id }));
        router.refresh();
      } catch (submitError) {
        setCategoryError(submitError instanceof Error ? submitError.message : "No se pudo crear la categoría.");
      } finally {
        setBusyTarget(null);
      }
    });
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
          body: JSON.stringify({ name: editCategoryName }),
        });
        setEditingCategory(null);
        setEditCategoryName("");
        router.refresh();
      } catch (submitError) {
        setEditCategoryError(submitError instanceof Error ? submitError.message : "No se pudo actualizar la categoría.");
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteCategoryError(null);
        setBusyTarget(`category:delete:${deletingCategory.id}`);
        await apiFetch(`/api/expense-categories/${deletingCategory.id}`, { method: "DELETE" });
        if (form.categoryId === deletingCategory.id) {
          setForm((prev) => ({ ...prev, categoryId: categories.find((item) => item.id !== deletingCategory.id)?.id ?? "" }));
        }
        if (categoryFilter === deletingCategory.id) {
          setCategoryFilter("");
        }
        setDeletingCategory(null);
        router.refresh();
      } catch (submitError) {
        setDeleteCategoryError(submitError instanceof Error ? submitError.message : "No se pudo eliminar la categoría.");
      } finally {
        setBusyTarget(null);
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Gastos" title="Gastos" description="" demoMode={demoMode} />

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="border-rose-950/35 bg-gradient-to-br from-rose-950 via-rose-900 to-coral text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-50/78">Pagado real</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.paidUsd)}</div>
          <p className="mt-2 text-sm text-rose-50/88">Salida efectivamente pagada.</p>
        </Card>
        <Card className="border-amber-950/30 bg-gradient-to-br from-amber-950 via-amber-900 to-coral text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/80">Pendiente a pagar</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.openUsd)}</div>
          <p className="mt-2 text-sm text-amber-50/90">Incluye pendientes vigentes y vencidos.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt">Fijo pagado</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.fixedPaidUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Costos operativos estables ya absorbidos.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-950">Variable pagado</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.variablePaidUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Movimientos puntuales ya consolidados.</p>
        </Card>
      </div>

      <Card>
        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.25fr]">
          <form className="space-y-4" onSubmit={handleCategorySubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">Categorías de gastos</h2>
              <p className="mt-1 text-sm text-ink/55">Se reutiliza el mismo catálogo operativo para Gastos y Recurrentes, sin duplicar fuentes de verdad.</p>
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
                placeholder="Ej: Impuestos, Herramientas IA"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <p className="mt-3 text-xs text-ink/55">El backend mantiene la protección si la categoría está usada por movimientos o plantillas recurrentes.</p>
            </div>

            {categoryError ? <p className="text-sm text-brick">{categoryError}</p> : null}

            <Button type="submit" disabled={isPending || demoMode || categoryName.trim().length < 2}>
              {demoMode ? "Requiere DATABASE_URL" : isPending && busyTarget === "category:new" ? "Guardando…" : "Crear categoría"}
            </Button>
          </form>

          <div className="space-y-4">
            <div>
              <h3 className="font-display text-2xl text-ink">Catálogo activo</h3>
              <p className="mt-1 text-sm text-ink/55">Editar renombra sin tocar histórico. Eliminar sigue protegido cuando la categoría ya está referenciada.</p>
            </div>

            {categories.length === 0 ? (
              <EmptyState title="Sin categorías" description="Creá la primera categoría para empezar a clasificar gastos." />
            ) : (
              <DataTable headers={["Categoría", "Origen", "Uso", "Acciones"]} scrollAfter={6} maxHeightClassName="max-h-[22rem]">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{category.name}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-ink/45">ID corto · {category.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={category.isDefault ? "neutral" : "success"}>{category.isDefault ? "Base" : "Custom"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{categorySummary.usageByCategory[category.id] ?? 0}</div>
                      <div className="text-xs text-ink/55">referencias totales</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={`Editar ${category.name}`}
                          className={actionButtonClass()}
                          type="button"
                          onClick={() => {
                            setEditingCategory(category);
                            setEditCategoryName(category.name);
                            setEditCategoryError(null);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Eliminar ${category.name}`}
                          className={actionButtonClass("danger")}
                          type="button"
                          onClick={() => {
                            setDeletingCategory(category);
                            setDeleteCategoryError(null);
                          }}
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

      <div className="space-y-6">
        <Card>
          <form className="space-y-5" onSubmit={handleExpenseSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo gasto</h2>
              <p className="mt-1 text-sm text-ink/55">La estructura sigue el flujo de Ingresos: temporalidad, datos base y ledger operativo abajo.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SegmentedControl
                label="Temporalidad"
                value={form.status}
                options={statusSegments}
                activeToneClassName={form.status === "PAID" ? "bg-rose-700" : "bg-amber-700"}
                onChange={(status) =>
                  setForm((prev) => ({
                    ...prev,
                    status,
                    dueDate: status === "PENDING" ? prev.dueDate || prev.date : prev.dueDate,
                  }))
                }
              />
              <SegmentedControl
                label="Tipo"
                value={form.expenseType}
                options={typeSegments}
                activeToneClassName={form.expenseType === "fixed" ? "bg-cobalt" : "bg-rose-700"}
                onChange={(expenseType) => setForm((prev) => ({ ...prev, expenseType }))}
              />
            </div>

            <div className={`grid gap-4 ${form.status === "PENDING" ? "md:grid-cols-2" : ""}`}>
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
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Categoría</label>
                <Select value={form.categoryId} onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
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
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Descripción</label>
              <Input placeholder="Opcional" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>

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

            {error ? <p className="text-sm text-brick">{error}</p> : null}

            <Button type="submit" disabled={isPending || demoMode || !form.categoryId}>
              {demoMode ? "Requiere DATABASE_URL" : isPending && busyTarget === "expense:new" ? "Guardando…" : "Registrar gasto"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Ledger de gastos</h2>
              <p className="mt-1 text-sm text-ink/55">Un único ledger operativo, con pendientes y vencidos alineados al criterio de Ingresos.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select className="max-w-[220px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ExpenseLedgerStatus | "")}>
                <option value="">Todos los estados</option>
                <option value="PAID">Pagado</option>
                <option value="PENDING">Pendiente</option>
                <option value="OVERDUE">Vencido</option>
              </Select>
              <Select className="max-w-[220px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ExpenseType | "")}>
                <option value="">Todos los tipos</option>
                <option value="fixed">Fijo</option>
                <option value="variable">Variable</option>
              </Select>
              <Select className="max-w-[220px]" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-900/10 bg-[linear-gradient(90deg,rgba(255,241,242,0.96),rgba(255,255,255,0.95))] px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-950/70">Total filtrado</div>
              <div className="mt-1 text-sm text-ink/60">{filteredTotals.count} movimientos visibles</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">USD</div>
              <div className="mt-1 font-display text-2xl text-rose-950">{formatUsd(filteredTotals.amountUsd)}</div>
            </div>
          </div>

          {visibleExpenses.length === 0 ? (
            <EmptyState title="Sin gastos" description="Cargá pagos o compromisos y filtrá por estado, tipo o categoría." />
          ) : (
            <DataTable
              headers={["Fecha", "Categoría", "Descripción", "Tipo", "USD", "Corresponde a", "Proyecto", "Estado", "Acción"]}
              footer={
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink" colSpan={4}>
                    Total filtrado
                  </td>
                  <td className="px-4 py-3 font-semibold text-rose-950">{formatUsd(filteredTotals.amountUsd)}</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/45">{filteredTotals.count} filas</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                </tr>
              }
            >
              {visibleExpenses.map((expense) => (
                <tr key={expense.id} className={statusRowClassName(expense.displayStatus)}>
                  <td className="px-4 py-3">{formatShortDate(expense.date)}</td>
                  <td className="px-4 py-3">{expense.categoryName}</td>
                  <td className="px-4 py-3 text-ink/70">{expense.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${typeChip(expense.expenseType)}`}>
                      {expense.expenseType === "fixed" ? "Fijo" : "Variable"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatUsd(expense.amountUsd)}</td>
                  <td className="px-4 py-3">{formatShortDate(expense.correspondsToDate)}</td>
                  <td className="px-4 py-3">{expense.projectName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusChip(expense.displayStatus)}`}>
                      {formatExpenseStatus(expense.displayStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() =>
                          setExpenseEditor({
                            expense,
                            lockedReason: getExpenseLockedReason(expense),
                          })
                        }
                      >
                        Editar
                      </Button>
                      {expense.displayStatus !== "PAID" ? (
                        <Button
                          type="button"
                          className="px-3 py-1.5 text-xs"
                          disabled={isPending || demoMode || Boolean(expense.salaryWithdrawalId) || Boolean(expense.scheduledExpenseId)}
                          onClick={() => handleMarkPaid(expense)}
                        >
                          {demoMode ? "Demo" : busyTarget === `expense:paid:${expense.id}` ? "Registrando…" : "Marcar pagado"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <ExpenseEntryModal
        categories={categories}
        date={expenseEditor?.expense.date ?? new Date().toISOString().slice(0, 10)}
        description="Corregí el gasto operativo y el cambio impacta en totales, indicadores y consistencia financiera."
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
        description="Renombrá la categoría sin tocar el histórico. El catálogo compartido sigue siendo el mismo para gastos y recurrentes."
        submitLabel="Guardar categoría"
        isPending={isPending}
        disabled={demoMode}
        error={editCategoryError}
        onClose={() => {
          setEditingCategory(null);
          setEditCategoryName("");
          setEditCategoryError(null);
        }}
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
        description="La categoría solo puede eliminarse si no tiene gastos ni plantillas recurrentes vinculadas."
        confirmLabel="Eliminar categoría"
        isPending={isPending}
        disabled={demoMode}
        error={deleteCategoryError}
        onClose={() => {
          setDeletingCategory(null);
          setDeleteCategoryError(null);
        }}
        onConfirm={handleDeleteCategory}
      >
        {deletingCategory ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Categoría: <span className="font-semibold text-ink">{deletingCategory.name}</span>.
            </p>
            <p>
              Uso detectado: <span className="font-semibold text-ink">{categorySummary.usageByCategory[deletingCategory.id] ?? 0}</span> referencia(s).
            </p>
            <p className="text-ink/60">Si el backend detecta uso en gastos o recurrentes, va a bloquear la eliminación.</p>
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
