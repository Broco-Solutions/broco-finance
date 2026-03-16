"use client";

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
import { PayScheduledExpenseModal } from "@/components/expenses/pay-scheduled-expense-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
  sourceLabel: string;
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
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [payableExpense, setPayableExpense] = useState<ScheduledExpenseRecord | null>(null);
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
        sourceLabel: "Plantilla recurrente",
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
        sourceLabel: expense.salaryWithdrawalId
          ? "Sincronizado desde distribución"
          : expense.scheduledExpenseId
            ? "Pagado desde plantilla recurrente"
            : "Carga manual",
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
        title={header.title}
        description={header.description}
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
                    <td className="px-4 py-3">{formatShortDate(row.date)}</td>
                    <td className="px-4 py-3">{row.categoryName}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{row.description}</div>
                      <div className="text-xs uppercase tracking-[0.14em] text-ink/45">{row.sourceLabel}</div>
                    </td>
                    <td className="px-4 py-3">{row.projectName ?? "Operativo"}</td>
                    <td className="px-4 py-3">{formatArs(row.amountArs)}</td>
                    <td className="px-4 py-3">{formatUsd(row.amountUsd)}</td>
                    <td className="px-4 py-3 uppercase">{row.expenseType}</td>
                    <td className="px-4 py-3">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3">
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
    </div>
  );
}
