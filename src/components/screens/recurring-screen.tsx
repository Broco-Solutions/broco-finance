"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Pencil, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ExpenseCategoryRecord,
  ExpenseType,
  ProjectRecord,
  RecurrenceScope,
  RecurringExpenseRecord,
  RecurringIncomeRecord,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";
import {
  cn,
  formatExpenseType,
  formatRecurringIncomeSource,
  formatRecurringSeriesStatus,
  formatShortDate,
  formatUsd,
} from "@/lib/utils";
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

type SeriesFilter = "ACTIVE" | "FINALIZED" | "ALL";

type ManualIncomeFormState = {
  clientId: string;
  projectId: string;
  amountUsd: string;
  startDate: string;
  endDate: string;
};

type IncomeEditFormState = ManualIncomeFormState & {
  scope: RecurrenceScope;
};

type ExpenseFormState = {
  categoryId: string;
  projectId: string;
  description: string;
  amountUsd: string;
  startDate: string;
  endDate: string;
  expenseType: ExpenseType;
};

type ExpenseEditFormState = ExpenseFormState & {
  scope: RecurrenceScope;
};

type FinalizeTarget =
  | { kind: "income"; series: RecurringIncomeRecord }
  | { kind: "expense"; series: RecurringExpenseRecord };

const scopeOptions: Array<{ value: RecurrenceScope; label: string; hint: string }> = [
  {
    value: "CURRENT_ONLY",
    label: "Solo esta ocurrencia",
    hint: "Ajusta solo el próximo ciclo abierto sin tocar la serie madre.",
  },
  {
    value: "CURRENT_AND_FUTURE",
    label: "Esta y las futuras no cobradas/pagadas",
    hint: "Reescribe el ciclo abierto y las futuras ocurrencias operativas.",
  },
  {
    value: "FUTURE_FROM_NEXT",
    label: "Solo futuras desde el próximo ciclo",
    hint: "Deja intacto el ciclo abierto actual y cambia desde el siguiente.",
  },
];

function isClosedProject(status: ProjectRecord["status"]) {
  return status === "COMPLETED" || status === "CANCELLED";
}

function buildManualIncomeForm(projects: ProjectRecord[]): ManualIncomeFormState {
  const fallbackProject = projects[0] ?? null;

  return {
    clientId: fallbackProject?.clientId ?? "",
    projectId: fallbackProject?.id ?? "",
    amountUsd: fallbackProject?.monthlyFeeUsd ? String(fallbackProject.monthlyFeeUsd) : "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: fallbackProject?.monthlyFeeEndDate ?? "",
  };
}

function buildIncomeEditForm(series: RecurringIncomeRecord, projects: ProjectRecord[]): IncomeEditFormState {
  const project = projects.find((item) => item.id === series.projectId) ?? null;

  return {
    clientId: project?.clientId ?? "",
    projectId: series.projectId,
    amountUsd: String(series.amountUsd),
    startDate: series.startDate,
    endDate: series.endDate ?? "",
    scope: "CURRENT_AND_FUTURE",
  };
}

function buildExpenseForm(categories: ExpenseCategoryRecord[]): ExpenseFormState {
  return {
    categoryId: categories[0]?.id ?? "",
    projectId: "",
    description: "",
    amountUsd: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    expenseType: "fixed",
  };
}

function buildExpenseEditForm(series: RecurringExpenseRecord): ExpenseEditFormState {
  return {
    categoryId: series.categoryId,
    projectId: series.projectId ?? "",
    description: series.description,
    amountUsd: String(series.amountUsd),
    startDate: series.startDate,
    endDate: series.endDate ?? "",
    expenseType: series.expenseType,
    scope: "CURRENT_AND_FUTURE",
  };
}

function seriesTone(status: RecurringIncomeRecord["seriesStatus"] | RecurringExpenseRecord["seriesStatus"]) {
  return status === "ACTIVE" ? "success" : "neutral";
}

function actionButtonClass() {
  return "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition-transform duration-150 ease-out hover:bg-black/5 active:scale-[0.97]";
}

function SectionEyebrow({
  tone,
  label,
  description,
}: {
  tone: "income" | "expense";
  label: string;
  description: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
          tone === "income" ? "border-emerald-900/12 bg-emerald-50 text-emerald-950" : "border-rose-900/12 bg-rose-50 text-rose-950",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-ink/58">{description}</p>
    </div>
  );
}

export function RecurringScreen({
  recurringIncomes,
  recurringExpenses,
  projects,
  categories,
  demoMode,
}: {
  recurringIncomes: RecurringIncomeRecord[];
  recurringExpenses: RecurringExpenseRecord[];
  projects: ProjectRecord[];
  categories: ExpenseCategoryRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [incomeEditError, setIncomeEditError] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseEditError, setExpenseEditError] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [incomeFilter, setIncomeFilter] = useState<SeriesFilter>("ACTIVE");
  const [expenseFilter, setExpenseFilter] = useState<SeriesFilter>("ACTIVE");
  const [editingIncome, setEditingIncome] = useState<RecurringIncomeRecord | null>(null);
  const [editingExpense, setEditingExpense] = useState<RecurringExpenseRecord | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<FinalizeTarget | null>(null);

  const activeIncomeProjectIds = useMemo(
    () => new Set(recurringIncomes.filter((series) => series.isActive).map((series) => series.projectId)),
    [recurringIncomes],
  );

  const availableManualIncomeProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          !isClosedProject(project.status) &&
          (!activeIncomeProjectIds.has(project.id) || editingIncome?.projectId === project.id),
      ),
    [activeIncomeProjectIds, editingIncome?.projectId, projects],
  );

  const [incomeForm, setIncomeForm] = useState<ManualIncomeFormState>(() => buildManualIncomeForm(availableManualIncomeProjects));
  const [incomeEditForm, setIncomeEditForm] = useState<IncomeEditFormState | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => buildExpenseForm(categories));
  const [expenseEditForm, setExpenseEditForm] = useState<ExpenseEditFormState | null>(null);

  const incomeClients = useMemo(() => {
    const seen = new Set<string>();

    return availableManualIncomeProjects
      .filter((project) => {
        if (seen.has(project.clientId)) {
          return false;
        }

        seen.add(project.clientId);
        return true;
      })
      .map((project) => ({ clientId: project.clientId, clientName: project.clientName }))
      .sort((left, right) => left.clientName.localeCompare(right.clientName));
  }, [availableManualIncomeProjects]);

  const createIncomeProjects = useMemo(
    () => availableManualIncomeProjects.filter((project) => project.clientId === incomeForm.clientId),
    [availableManualIncomeProjects, incomeForm.clientId],
  );

  const editIncomeProjects = useMemo(() => {
    if (!incomeEditForm) {
      return [];
    }

    return availableManualIncomeProjects.filter((project) => project.clientId === incomeEditForm.clientId);
  }, [availableManualIncomeProjects, incomeEditForm]);

  const visibleIncomes = useMemo(() => {
    if (incomeFilter === "ALL") {
      return recurringIncomes;
    }

    return recurringIncomes.filter((series) => series.seriesStatus === incomeFilter);
  }, [incomeFilter, recurringIncomes]);

  const visibleExpenses = useMemo(() => {
    if (expenseFilter === "ALL") {
      return recurringExpenses;
    }

    return recurringExpenses.filter((series) => series.seriesStatus === expenseFilter);
  }, [expenseFilter, recurringExpenses]);

  const incomeSummary = useMemo(
    () => ({
      activeCount: recurringIncomes.filter((series) => series.isActive).length,
      activeAmountUsd: recurringIncomes.filter((series) => series.isActive).reduce((sum, series) => sum + series.amountUsd, 0),
      projectManaged: recurringIncomes.filter((series) => series.source === "PROJECT" && series.isActive).length,
      manualManaged: recurringIncomes.filter((series) => series.source === "MANUAL" && series.isActive).length,
    }),
    [recurringIncomes],
  );

  const expenseSummary = useMemo(
    () => ({
      activeCount: recurringExpenses.filter((series) => series.isActive).length,
      activeAmountUsd: recurringExpenses.filter((series) => series.isActive).reduce((sum, series) => sum + series.amountUsd, 0),
      fixedCount: recurringExpenses.filter((series) => series.isActive && series.expenseType === "fixed").length,
      variableCount: recurringExpenses.filter((series) => series.isActive && series.expenseType === "variable").length,
    }),
    [recurringExpenses],
  );

  const resetIncomeForm = () => {
    setIncomeForm(buildManualIncomeForm(availableManualIncomeProjects));
    setIncomeError(null);
  };

  const handleIncomeClientChange = (clientId: string, target: "create" | "edit") => {
    const nextProjects = availableManualIncomeProjects.filter((project) => project.clientId === clientId);
    const nextProject = nextProjects[0] ?? null;

    if (target === "create") {
      setIncomeForm((prev) => ({
        ...prev,
        clientId,
        projectId: nextProject?.id ?? "",
      }));
      return;
    }

    setIncomeEditForm((prev) =>
      prev
        ? {
            ...prev,
            clientId,
            projectId: nextProject?.id ?? "",
          }
        : prev,
    );
  };

  const handleCreateIncome = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      try {
        setIncomeError(null);
        await apiFetch("/api/recurring-incomes", {
          method: "POST",
          body: JSON.stringify({
            projectId: incomeForm.projectId,
            amountUsd: Number(incomeForm.amountUsd),
            startDate: incomeForm.startDate,
            endDate: incomeForm.endDate || null,
          }),
        });
        resetIncomeForm();
        router.refresh();
      } catch (submitError) {
        setIncomeError(submitError instanceof Error ? submitError.message : "No se pudo crear la serie de ingreso.");
      }
    });
  };

  const openIncomeEditor = (series: RecurringIncomeRecord) => {
    setEditingIncome(series);
    setIncomeEditForm(buildIncomeEditForm(series, projects));
    setIncomeEditError(null);
  };

  const closeIncomeEditor = () => {
    setEditingIncome(null);
    setIncomeEditForm(null);
    setIncomeEditError(null);
  };

  const handleEditIncome = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingIncome || !incomeEditForm) {
      return;
    }

    startTransition(async () => {
      try {
        setIncomeEditError(null);
        await apiFetch(`/api/recurring-incomes/${editingIncome.id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "edit",
            scope: incomeEditForm.scope,
            projectId: incomeEditForm.projectId,
            amountUsd: Number(incomeEditForm.amountUsd),
            startDate: incomeEditForm.startDate,
            endDate: incomeEditForm.endDate || null,
          }),
        });
        closeIncomeEditor();
        router.refresh();
      } catch (submitError) {
        setIncomeEditError(submitError instanceof Error ? submitError.message : "No se pudo editar la serie de ingreso.");
      }
    });
  };

  const handleCreateExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      try {
        setExpenseError(null);
        await apiFetch("/api/recurring-expenses", {
          method: "POST",
          body: JSON.stringify({
            description: expenseForm.description || null,
            categoryId: expenseForm.categoryId,
            projectId: expenseForm.projectId || null,
            expenseType: expenseForm.expenseType,
            amountUsd: Number(expenseForm.amountUsd),
            startDate: expenseForm.startDate,
            endDate: expenseForm.endDate || null,
            frequency: "monthly",
            isActive: true,
          }),
        });
        setExpenseForm(buildExpenseForm(categories));
        router.refresh();
      } catch (submitError) {
        setExpenseError(submitError instanceof Error ? submitError.message : "No se pudo crear la serie de gasto.");
      }
    });
  };

  const openExpenseEditor = (series: RecurringExpenseRecord) => {
    setEditingExpense(series);
    setExpenseEditForm(buildExpenseEditForm(series));
    setExpenseEditError(null);
  };

  const closeExpenseEditor = () => {
    setEditingExpense(null);
    setExpenseEditForm(null);
    setExpenseEditError(null);
  };

  const handleEditExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingExpense || !expenseEditForm) {
      return;
    }

    startTransition(async () => {
      try {
        setExpenseEditError(null);
        await apiFetch(`/api/recurring-expenses/${editingExpense.id}`, {
          method: "PUT",
          body: JSON.stringify({
            action: "edit",
            scope: expenseEditForm.scope,
            description: expenseEditForm.description || null,
            categoryId: expenseEditForm.categoryId,
            projectId: expenseEditForm.projectId || null,
            expenseType: expenseEditForm.expenseType,
            amountUsd: Number(expenseEditForm.amountUsd),
            startDate: expenseEditForm.startDate,
            endDate: expenseEditForm.endDate || null,
            frequency: "monthly",
            isActive: true,
          }),
        });
        closeExpenseEditor();
        router.refresh();
      } catch (submitError) {
        setExpenseEditError(submitError instanceof Error ? submitError.message : "No se pudo editar la serie de gasto.");
      }
    });
  };

  const handleFinalize = () => {
    if (!finalizeTarget) {
      return;
    }

    startTransition(async () => {
      try {
        setFinalizeError(null);

        if (finalizeTarget.kind === "income") {
          await apiFetch(`/api/recurring-incomes/${finalizeTarget.series.id}`, {
            method: "PUT",
            body: JSON.stringify({
              action: "finalize",
              scope: "CURRENT_AND_FUTURE",
              projectId: finalizeTarget.series.projectId,
              amountUsd: finalizeTarget.series.amountUsd,
              startDate: finalizeTarget.series.startDate,
              endDate: new Date().toISOString().slice(0, 10),
            }),
          });
        } else {
          await apiFetch(`/api/recurring-expenses/${finalizeTarget.series.id}`, {
            method: "PUT",
            body: JSON.stringify({
              action: "finalize",
              scope: "CURRENT_AND_FUTURE",
              description: finalizeTarget.series.description || null,
              categoryId: finalizeTarget.series.categoryId,
              projectId: finalizeTarget.series.projectId || null,
              expenseType: finalizeTarget.series.expenseType,
              amountUsd: finalizeTarget.series.amountUsd,
              startDate: finalizeTarget.series.startDate,
              endDate: new Date().toISOString().slice(0, 10),
              frequency: "monthly",
              isActive: false,
            }),
          });
        }

        setFinalizeTarget(null);
        router.refresh();
      } catch (submitError) {
        setFinalizeError(submitError instanceof Error ? submitError.message : "No se pudo finalizar la serie.");
      }
    });
  };

  const incomeEditIsCurrentOnly = incomeEditForm?.scope === "CURRENT_ONLY";
  const expenseEditIsCurrentOnly = expenseEditForm?.scope === "CURRENT_ONLY";
  const editingProject = incomeEditForm ? projects.find((project) => project.id === incomeEditForm.projectId) ?? null : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recurrentes"
        title="Recurrentes"
        description=""
        demoMode={demoMode}
        meta={
          <>
            <Badge tone="neutral">Series madre</Badge>
            <Badge tone="neutral">Operación en ledgers</Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="border-emerald-950/35 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/78">Ingresos activos</div>
          <div className="mt-3 font-display text-4xl text-white">{incomeSummary.activeCount}</div>
          <p className="mt-2 text-sm text-emerald-50/88">Series que siguen generando cobros operativos mensuales.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950">Ingreso mensual recurrente</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(incomeSummary.activeAmountUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">
            {incomeSummary.projectManaged} desde Proyecto · {incomeSummary.manualManaged} manuales.
          </p>
        </Card>
        <Card className="border-rose-950/30 bg-gradient-to-br from-rose-950 via-rose-900 to-coral text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-50/80">Gastos activos</div>
          <div className="mt-3 font-display text-4xl text-white">{expenseSummary.activeCount}</div>
          <p className="mt-2 text-sm text-rose-50/88">Plantillas mensuales que siguen generando pagos comprometidos.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-950">Compromiso mensual</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(expenseSummary.activeAmountUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">
            {expenseSummary.fixedCount} fijos · {expenseSummary.variableCount} variables.
          </p>
        </Card>
      </div>

      <Card className="border-emerald-900/10 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(255,255,255,0.96))]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionEyebrow
            tone="income"
            label="Ingresos recurrentes"
            description="Acá se administra la serie madre. Las ocurrencias concretas, sus vencimientos y su cobro real siguen operándose en el ledger de Ingresos."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Fuente Proyecto</div>
              <div className="mt-1 font-display text-2xl text-ink">{incomeSummary.projectManaged}</div>
            </div>
            <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Manuales</div>
              <div className="mt-1 font-display text-2xl text-ink">{incomeSummary.manualManaged}</div>
            </div>
            <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Máx. por proyecto</div>
              <div className="mt-1 font-display text-2xl text-emerald-950">1</div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-6 xl:grid-cols-[0.92fr,1.35fr]">
          <form className="space-y-5" onSubmit={handleCreateIncome}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo ingreso recurrente manual</h2>
              <p className="mt-1 text-sm text-ink/55">Siempre mensual, con cliente y proyecto obligatorios. Si el proyecto ya tiene serie activa, queda bloqueado para evitar duplicidad.</p>
            </div>

            {availableManualIncomeProjects.length === 0 ? (
              <EmptyState
                title="Sin proyectos disponibles"
                description="Todos los proyectos activos ya están cubiertos por una serie de ingreso o el proyecto está cerrado."
              />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Cliente</label>
                    <Select value={incomeForm.clientId} onChange={(event) => handleIncomeClientChange(event.target.value, "create")}>
                      {incomeClients.map((client) => (
                        <option key={client.clientId} value={client.clientId}>
                          {client.clientName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
                    <Select value={incomeForm.projectId} onChange={(event) => setIncomeForm((prev) => ({ ...prev, projectId: event.target.value }))}>
                      {createIncomeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto mensual USD</label>
                    <Input
                      min="0"
                      step="0.01"
                      type="number"
                      value={incomeForm.amountUsd}
                      onChange={(event) => setIncomeForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Primer ciclo</label>
                    <Input
                      type="date"
                      value={incomeForm.startDate}
                      onChange={(event) => setIncomeForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha fin</label>
                    <Input
                      type="date"
                      value={incomeForm.endDate}
                      onChange={(event) => setIncomeForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-[1.2rem] border border-emerald-900/12 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
                  Esta serie genera ocurrencias operativas en Ingresos, pero no reemplaza el ledger. Si querés cambiar un cobro puntual, podés hacerlo luego con alcance desde esta misma sección.
                </div>

                {incomeError ? <p className="text-sm text-brick">{incomeError}</p> : null}

                <Button
                  type="submit"
                  disabled={isPending || demoMode || !incomeForm.projectId || !incomeForm.amountUsd || !incomeForm.startDate}
                >
                  {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear serie manual"}
                </Button>
              </>
            )}
          </form>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-ink">Series de ingreso</h3>
                <p className="mt-1 text-sm text-ink/55">Proyecto sigue siendo source of truth cuando el origen es `Proyecto`. Desde acá podés ajustar el alcance hacia adelante sin tocar históricos cobrados.</p>
              </div>
              <Select className="max-w-[220px]" value={incomeFilter} onChange={(event) => setIncomeFilter(event.target.value as SeriesFilter)}>
                <option value="ACTIVE">Activas</option>
                <option value="FINALIZED">Finalizadas</option>
                <option value="ALL">Todas</option>
              </Select>
            </div>

            {visibleIncomes.length === 0 ? (
              <EmptyState title="Sin series visibles" description="Cambiá el filtro o creá una serie manual para empezar a administrar ingresos recurrentes." />
            ) : (
              <DataTable
                headers={["Cliente", "Proyecto", "Origen", "Monto mensual", "Próximo ciclo", "Fecha fin", "Estado", "Acciones"]}
                scrollAfter={7}
                tableClassName="min-w-[72rem]"
              >
                {visibleIncomes.map((series) => (
                  <tr key={series.id}>
                    <td className="px-4 py-3">{series.clientName}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{series.projectName}</div>
                      <div className="text-xs text-ink/55">{series.pendingCount} ocurrencia(s) abiertas</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={series.source === "PROJECT" ? "success" : "neutral"}>{formatRecurringIncomeSource(series.source)}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatUsd(series.amountUsd)}</td>
                    <td className="px-4 py-3">{formatShortDate(series.nextExpectedDate)}</td>
                    <td className="px-4 py-3">{formatShortDate(series.endDate)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={seriesTone(series.seriesStatus)}>{formatRecurringSeriesStatus(series.seriesStatus)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button aria-label={`Editar ${series.projectName}`} className={actionButtonClass()} type="button" onClick={() => openIncomeEditor(series)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        {series.isActive ? (
                          <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setFinalizeTarget({ kind: "income", series })}>
                            Finalizar
                          </Button>
                        ) : null}
                        <Link className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/8" href={`/projects/${series.projectId}`} prefetch>
                          Abrir proyecto
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-rose-900/10 bg-[linear-gradient(135deg,rgba(255,241,242,0.92),rgba(255,255,255,0.96))]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionEyebrow
            tone="expense"
            label="Gastos recurrentes"
            description="Acá viven las plantillas mensuales de egresos. El ledger de Gastos sigue siendo el carril operativo para ver vencidos, pendientes y pagos concretos."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Series activas</div>
              <div className="mt-1 font-display text-2xl text-ink">{expenseSummary.activeCount}</div>
            </div>
            <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Fijos</div>
              <div className="mt-1 font-display text-2xl text-ink">{expenseSummary.fixedCount}</div>
            </div>
            <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Variables</div>
              <div className="mt-1 font-display text-2xl text-ink">{expenseSummary.variableCount}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-6 xl:grid-cols-[0.92fr,1.35fr]">
          <form className="space-y-5" onSubmit={handleCreateExpense}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo gasto recurrente</h2>
              <p className="mt-1 text-sm text-ink/55">Usa el mismo catálogo de categorías que Gastos. El proyecto es opcional, la recurrencia es siempre mensual y el histórico pagado no se reescribe.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Categoría</label>
                <Select value={expenseForm.categoryId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
                <Select value={expenseForm.projectId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, projectId: event.target.value }))}>
                  <option value="">Sin proyecto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.clientName} · {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Tipo</label>
                <Select value={expenseForm.expenseType} onChange={(event) => setExpenseForm((prev) => ({ ...prev, expenseType: event.target.value as ExpenseType }))}>
                  <option value="fixed">Fijo</option>
                  <option value="variable">Variable</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto mensual USD</label>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={expenseForm.amountUsd}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Descripción</label>
              <Input
                placeholder="Opcional"
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Primer ciclo</label>
                <Input
                  type="date"
                  value={expenseForm.startDate}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha fin</label>
                <Input
                  type="date"
                  value={expenseForm.endDate}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-rose-900/12 bg-rose-50/75 px-4 py-3 text-sm text-rose-950">
              Las ocurrencias generadas irán al ledger de Gastos. Desde acá sólo administrás la plantilla madre y cómo se propagan cambios hacia adelante.
            </div>

            {expenseError ? <p className="text-sm text-brick">{expenseError}</p> : null}

            <Button
              type="submit"
              disabled={isPending || demoMode || !expenseForm.categoryId || !expenseForm.amountUsd || !expenseForm.startDate}
            >
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear serie de gasto"}
            </Button>
          </form>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-ink">Series de gasto</h3>
                <p className="mt-1 text-sm text-ink/55">No se listan todas las ocurrencias del mes para no duplicar el ledger. La lectura acá es de plantilla, no de operación diaria.</p>
              </div>
              <Select className="max-w-[220px]" value={expenseFilter} onChange={(event) => setExpenseFilter(event.target.value as SeriesFilter)}>
                <option value="ACTIVE">Activas</option>
                <option value="FINALIZED">Finalizadas</option>
                <option value="ALL">Todas</option>
              </Select>
            </div>

            {visibleExpenses.length === 0 ? (
              <EmptyState title="Sin series visibles" description="Cambiá el filtro o cargá una nueva plantilla de gasto recurrente." />
            ) : (
              <DataTable
                headers={["Categoría", "Descripción", "Proyecto", "Tipo", "Monto mensual", "Próximo ciclo", "Fecha fin", "Estado", "Acciones"]}
                scrollAfter={7}
                tableClassName="min-w-[76rem]"
              >
                {visibleExpenses.map((series) => (
                  <tr key={series.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{series.categoryName}</div>
                      <div className="text-xs text-ink/55">{series.pendingCount} ocurrencia(s) abiertas</div>
                    </td>
                    <td className="px-4 py-3 text-ink/70">{series.description || "—"}</td>
                    <td className="px-4 py-3">{series.projectName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={series.expenseType === "fixed" ? "neutral" : "danger"}>{formatExpenseType(series.expenseType)}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatUsd(series.amountUsd)}</td>
                    <td className="px-4 py-3">{formatShortDate(series.nextDueDate)}</td>
                    <td className="px-4 py-3">{formatShortDate(series.endDate)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={seriesTone(series.seriesStatus)}>{formatRecurringSeriesStatus(series.seriesStatus)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button aria-label={`Editar ${series.description || series.categoryName}`} className={actionButtonClass()} type="button" onClick={() => openExpenseEditor(series)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        {series.isActive ? (
                          <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setFinalizeTarget({ kind: "expense", series })}>
                            Finalizar
                          </Button>
                        ) : null}
                        {series.projectId ? (
                          <Link className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/8" href={`/projects/${series.projectId}`} prefetch>
                            Abrir proyecto
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      </Card>

      <EditEntityModal
        open={Boolean(editingIncome && incomeEditForm)}
        title={editingIncome?.source === "PROJECT" ? "Editar ingreso recurrente desde Proyecto" : "Editar ingreso recurrente manual"}
        description="Los cambios van siempre hacia adelante según el alcance elegido. Los históricos cobrados no se reescriben."
        submitLabel="Guardar cambios"
        widthClassName="max-w-3xl"
        isPending={isPending}
        disabled={demoMode}
        error={incomeEditError}
        onClose={closeIncomeEditor}
        onSubmit={handleEditIncome}
      >
        {editingIncome && incomeEditForm ? (
          <div className="space-y-5">
            <div className="rounded-[1.2rem] border border-black/8 bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={editingIncome.source === "PROJECT" ? "success" : "neutral"}>{formatRecurringIncomeSource(editingIncome.source)}</Badge>
                <Badge tone={seriesTone(editingIncome.seriesStatus)}>{formatRecurringSeriesStatus(editingIncome.seriesStatus)}</Badge>
              </div>
              <div className="mt-3 text-lg font-semibold text-ink">{editingIncome.clientName} · {editingIncome.projectName}</div>
              <div className="mt-1 text-sm text-ink/58">Próximo ciclo abierto: {formatShortDate(editingIncome.nextExpectedDate)}</div>
            </div>

            {editingIncome.source === "PROJECT" ? (
              <div className="rounded-[1.2rem] border border-emerald-900/15 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
                Esta serie nace del fee mensual del proyecto. Si elegís un alcance que toque futuros, se actualizan también `monthlyFeeUsd` y `monthlyFeeEndDate` del proyecto.
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Alcance del cambio</label>
              <Select value={incomeEditForm.scope} onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, scope: event.target.value as RecurrenceScope } : prev))}>
                {scopeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink/55">{scopeOptions.find((option) => option.value === incomeEditForm.scope)?.hint}</p>
            </div>

            {editingIncome.source === "MANUAL" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Cliente</label>
                  <Select
                    disabled={incomeEditIsCurrentOnly}
                    value={incomeEditForm.clientId}
                    onChange={(event) => handleIncomeClientChange(event.target.value, "edit")}
                  >
                    {incomeClients.map((client) => (
                      <option key={client.clientId} value={client.clientId}>
                        {client.clientName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
                  <Select
                    disabled={incomeEditIsCurrentOnly}
                    value={incomeEditForm.projectId}
                    onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, projectId: event.target.value } : prev))}
                  >
                    {editIncomeProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Cliente</label>
                  <Input disabled value={editingIncome.clientName} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
                  <Input disabled value={editingIncome.projectName} />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto mensual USD</label>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={incomeEditForm.amountUsd}
                  onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, amountUsd: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Primer ciclo</label>
                <Input
                  disabled={editingIncome.source === "PROJECT" || incomeEditIsCurrentOnly}
                  type="date"
                  value={incomeEditForm.startDate}
                  onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, startDate: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha fin</label>
                <Input
                  disabled={incomeEditIsCurrentOnly}
                  type="date"
                  value={incomeEditForm.endDate}
                  onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, endDate: event.target.value } : prev))}
                />
              </div>
            </div>

            {incomeEditIsCurrentOnly ? (
              <div className="rounded-[1.2rem] border border-amber-950/15 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                En `Solo esta ocurrencia` el sistema ajusta únicamente el próximo ciclo abierto. Proyecto, inicio y fecha fin de la serie madre no cambian.
              </div>
            ) : null}

            {editingProject && isClosedProject(editingProject.status) ? (
              <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 p-4 text-sm text-brick">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>El proyecto elegido está cerrado. El backend va a bloquear cambios que creen o muevan series manuales hacia ese proyecto.</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </EditEntityModal>

      <EditEntityModal
        open={Boolean(editingExpense && expenseEditForm)}
        title="Editar gasto recurrente"
        description="Elegí el alcance y ajustá solo la plantilla madre o también la ocurrencia abierta, siempre hacia adelante."
        submitLabel="Guardar cambios"
        widthClassName="max-w-3xl"
        isPending={isPending}
        disabled={demoMode}
        error={expenseEditError}
        onClose={closeExpenseEditor}
        onSubmit={handleEditExpense}
      >
        {editingExpense && expenseEditForm ? (
          <div className="space-y-5">
            <div className="rounded-[1.2rem] border border-black/8 bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={editingExpense.expenseType === "fixed" ? "neutral" : "danger"}>{formatExpenseType(editingExpense.expenseType)}</Badge>
                <Badge tone={seriesTone(editingExpense.seriesStatus)}>{formatRecurringSeriesStatus(editingExpense.seriesStatus)}</Badge>
              </div>
              <div className="mt-3 text-lg font-semibold text-ink">{editingExpense.categoryName}</div>
              <div className="mt-1 text-sm text-ink/58">Próximo ciclo abierto: {formatShortDate(editingExpense.nextDueDate)}</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Alcance del cambio</label>
              <Select value={expenseEditForm.scope} onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, scope: event.target.value as RecurrenceScope } : prev))}>
                {scopeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink/55">{scopeOptions.find((option) => option.value === expenseEditForm.scope)?.hint}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Categoría</label>
                <Select
                  disabled={expenseEditIsCurrentOnly}
                  value={expenseEditForm.categoryId}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, categoryId: event.target.value } : prev))}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
                <Select
                  disabled={expenseEditIsCurrentOnly}
                  value={expenseEditForm.projectId}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, projectId: event.target.value } : prev))}
                >
                  <option value="">Sin proyecto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.clientName} · {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Tipo</label>
                <Select
                  disabled={expenseEditIsCurrentOnly}
                  value={expenseEditForm.expenseType}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, expenseType: event.target.value as ExpenseType } : prev))}
                >
                  <option value="fixed">Fijo</option>
                  <option value="variable">Variable</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Monto mensual USD</label>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={expenseEditForm.amountUsd}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, amountUsd: event.target.value } : prev))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Descripción</label>
              <Input
                disabled={expenseEditIsCurrentOnly}
                value={expenseEditForm.description}
                onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Primer ciclo</label>
                <Input
                  disabled={expenseEditIsCurrentOnly}
                  type="date"
                  value={expenseEditForm.startDate}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, startDate: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha fin</label>
                <Input
                  disabled={expenseEditIsCurrentOnly}
                  type="date"
                  value={expenseEditForm.endDate}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, endDate: event.target.value } : prev))}
                />
              </div>
            </div>

            {expenseEditIsCurrentOnly ? (
              <div className="rounded-[1.2rem] border border-amber-950/15 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                En `Solo esta ocurrencia` solo se modifica el monto del próximo gasto abierto. La plantilla madre queda igual.
              </div>
            ) : null}
          </div>
        ) : null}
      </EditEntityModal>

      <ConfirmActionModal
        open={Boolean(finalizeTarget)}
        title={finalizeTarget?.kind === "income" ? "Finalizar ingreso recurrente" : "Finalizar gasto recurrente"}
        description="La serie deja de generar nuevas ocurrencias. Las futuras no cobradas o no pagadas se limpian sin tocar históricos ya conciliados."
        confirmLabel="Finalizar serie"
        isPending={isPending}
        disabled={demoMode}
        error={finalizeError}
        onClose={() => {
          setFinalizeTarget(null);
          setFinalizeError(null);
        }}
        onConfirm={handleFinalize}
      >
        {finalizeTarget ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Serie:{" "}
              <span className="font-semibold text-ink">
                {finalizeTarget.kind === "income" ? finalizeTarget.series.projectName : finalizeTarget.series.description || finalizeTarget.series.categoryName}
              </span>
              .
            </p>
            <p>
              Próximo ciclo abierto:{" "}
              <span className="font-semibold text-ink">
                {finalizeTarget.kind === "income"
                  ? formatShortDate(finalizeTarget.series.nextExpectedDate)
                  : formatShortDate(finalizeTarget.series.nextDueDate)}
              </span>
              .
            </p>
            <p className="text-ink/60">Las ocurrencias históricas ya cobradas o pagadas quedan intactas.</p>
            {demoMode ? <p>La operación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
