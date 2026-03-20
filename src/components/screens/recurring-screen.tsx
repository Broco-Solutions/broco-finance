"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Pencil } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
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
  return "inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition-transform duration-150 ease-out hover:bg-black/5 active:scale-[0.97]";
}

const dateInputClassName = "h-11 min-w-[12rem] tabular-nums";
const dateValueClassName = "whitespace-nowrap text-sm font-medium tabular-nums text-ink/72";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/42">{children}</label>;
}

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "income" | "expense";
}) {
  return (
    <div
      className={cn(
        "rounded-[1rem] border px-3.5 py-3",
        tone === "neutral" && "border-black/8 bg-white/82",
        tone === "income" && "border-emerald-900/10 bg-emerald-50/72",
        tone === "expense" && "border-rose-900/10 bg-rose-50/72",
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/42">{label}</div>
      <div className="mt-1 text-xl font-display text-ink">{value}</div>
    </div>
  );
}

function SectionHeader({
  tone,
  title,
  description,
  stats,
}: {
  tone: "income" | "expense";
  title: string;
  description: string;
  stats: Array<{ label: string; value: React.ReactNode; tone?: "neutral" | "income" | "expense" }>;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
            tone === "income" ? "border-emerald-900/12 bg-emerald-50 text-emerald-950" : "border-rose-900/12 bg-rose-50 text-rose-950",
          )}
        >
          {title}
        </div>
        <p className="mt-3 max-w-2xl text-sm text-ink/56">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <MetricPill key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
        ))}
      </div>
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

  const createManualIncomeProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          !isClosedProject(project.status) &&
          !activeIncomeProjectIds.has(project.id),
      ),
    [activeIncomeProjectIds, projects],
  );

  const editableManualIncomeProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          !isClosedProject(project.status) &&
          (!activeIncomeProjectIds.has(project.id) || editingIncome?.projectId === project.id),
      ),
    [activeIncomeProjectIds, editingIncome?.projectId, projects],
  );

  const [incomeForm, setIncomeForm] = useState<ManualIncomeFormState>(() => buildManualIncomeForm(createManualIncomeProjects));
  const [incomeEditForm, setIncomeEditForm] = useState<IncomeEditFormState | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => buildExpenseForm(categories));
  const [expenseEditForm, setExpenseEditForm] = useState<ExpenseEditFormState | null>(null);

  const incomeClients = useMemo(() => {
    const seen = new Set<string>();

    return createManualIncomeProjects
      .filter((project) => {
        if (seen.has(project.clientId)) {
          return false;
        }

        seen.add(project.clientId);
        return true;
      })
      .map((project) => ({ clientId: project.clientId, clientName: project.clientName }))
      .sort((left, right) => left.clientName.localeCompare(right.clientName));
  }, [createManualIncomeProjects]);

  const editIncomeClients = useMemo(() => {
    const seen = new Set<string>();

    return editableManualIncomeProjects
      .filter((project) => {
        if (seen.has(project.clientId)) {
          return false;
        }

        seen.add(project.clientId);
        return true;
      })
      .map((project) => ({ clientId: project.clientId, clientName: project.clientName }))
      .sort((left, right) => left.clientName.localeCompare(right.clientName));
  }, [editableManualIncomeProjects]);

  const createIncomeProjects = useMemo(
    () => createManualIncomeProjects.filter((project) => project.clientId === incomeForm.clientId),
    [createManualIncomeProjects, incomeForm.clientId],
  );

  const editIncomeProjects = useMemo(() => {
    if (!incomeEditForm) {
      return [];
    }

    return editableManualIncomeProjects.filter((project) => project.clientId === incomeEditForm.clientId);
  }, [editableManualIncomeProjects, incomeEditForm]);

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
    setIncomeForm(buildManualIncomeForm(createManualIncomeProjects));
    setIncomeError(null);
  };

  const handleIncomeClientChange = (clientId: string, target: "create" | "edit") => {
    const sourceProjects = target === "create" ? createManualIncomeProjects : editableManualIncomeProjects;
    const nextProjects = sourceProjects.filter((project) => project.clientId === clientId);
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

  useEffect(() => {
    setIncomeForm((prev) => {
      if (createManualIncomeProjects.length === 0) {
        return prev.clientId || prev.projectId ? buildManualIncomeForm(createManualIncomeProjects) : prev;
      }

      const clientExists = createManualIncomeProjects.some((project) => project.clientId === prev.clientId);
      const nextClientId = clientExists ? prev.clientId : createManualIncomeProjects[0]!.clientId;
      const nextClientProjects = createManualIncomeProjects.filter((project) => project.clientId === nextClientId);
      const projectExists = nextClientProjects.some((project) => project.id === prev.projectId);
      const nextProjectId = projectExists ? prev.projectId : nextClientProjects[0]?.id ?? "";

      if (nextClientId === prev.clientId && nextProjectId === prev.projectId) {
        return prev;
      }

      return {
        ...prev,
        clientId: nextClientId,
        projectId: nextProjectId,
      };
    });
  }, [createManualIncomeProjects]);

  useEffect(() => {
    if (!editingIncome || !incomeEditForm || editingIncome.source !== "MANUAL") {
      return;
    }

    const clientExists = editableManualIncomeProjects.some((project) => project.clientId === incomeEditForm.clientId);
    const nextClientId = clientExists ? incomeEditForm.clientId : editableManualIncomeProjects[0]?.clientId ?? "";
    const nextClientProjects = editableManualIncomeProjects.filter((project) => project.clientId === nextClientId);
    const projectExists = nextClientProjects.some((project) => project.id === incomeEditForm.projectId);
    const nextProjectId = projectExists ? incomeEditForm.projectId : nextClientProjects[0]?.id ?? "";

    if (nextClientId === incomeEditForm.clientId && nextProjectId === incomeEditForm.projectId) {
      return;
    }

    setIncomeEditForm((prev) =>
      prev
        ? {
            ...prev,
            clientId: nextClientId,
            projectId: nextProjectId,
          }
        : prev,
    );
  }, [editableManualIncomeProjects, editingIncome, incomeEditForm]);

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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-emerald-900/12 bg-[linear-gradient(135deg,rgba(236,253,245,0.76),rgba(255,255,255,0.96))]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-950/70">Ingresos recurrentes</div>
              <div className="mt-2 font-display text-4xl text-ink">{formatUsd(incomeSummary.activeAmountUsd)}</div>
              <p className="mt-1 text-sm text-ink/56">{incomeSummary.activeCount} series activas.</p>
            </div>
            <div className="grid min-w-[18rem] gap-3 sm:grid-cols-3">
              <MetricPill label="Proyecto" value={incomeSummary.projectManaged} tone="income" />
              <MetricPill label="Manual" value={incomeSummary.manualManaged} tone="income" />
              <MetricPill label="Máx. proyecto" value="1" />
            </div>
          </div>
        </Card>

        <Card className="border-rose-900/12 bg-[linear-gradient(135deg,rgba(255,241,242,0.76),rgba(255,255,255,0.96))]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-950/70">Gastos recurrentes</div>
              <div className="mt-2 font-display text-4xl text-ink">{formatUsd(expenseSummary.activeAmountUsd)}</div>
              <p className="mt-1 text-sm text-ink/56">{expenseSummary.activeCount} series activas.</p>
            </div>
            <div className="grid min-w-[18rem] gap-3 sm:grid-cols-3">
              <MetricPill label="Fijos" value={expenseSummary.fixedCount} tone="expense" />
              <MetricPill label="Variables" value={expenseSummary.variableCount} tone="expense" />
              <MetricPill label="Frecuencia" value="Mensual" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-6">
        <SectionHeader
          tone="income"
          title="Ingresos recurrentes"
          description="Administrá la serie madre. El cobro puntual sigue en Ingresos."
          stats={[
            { label: "Proyecto", value: incomeSummary.projectManaged, tone: "income" },
            { label: "Manual", value: incomeSummary.manualManaged, tone: "income" },
            { label: "Máx. por proyecto", value: "1" },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[0.88fr,1.42fr]">
          <form className="space-y-4" onSubmit={handleCreateIncome}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo ingreso manual</h2>
              <p className="mt-1 text-sm text-ink/54">Mensual, con cliente y proyecto obligatorios.</p>
            </div>

            {createManualIncomeProjects.length === 0 ? (
              <EmptyState
                title="Sin proyectos disponibles"
                description="Todos los proyectos activos ya tienen una serie o están cerrados."
              />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Cliente</FieldLabel>
                    <Select value={incomeForm.clientId} onChange={(event) => handleIncomeClientChange(event.target.value, "create")}>
                      {incomeClients.map((client) => (
                        <option key={client.clientId} value={client.clientId}>
                          {client.clientName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Proyecto</FieldLabel>
                    <Select value={incomeForm.projectId} onChange={(event) => setIncomeForm((prev) => ({ ...prev, projectId: event.target.value }))}>
                      {createIncomeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),12rem,12rem]">
                  <div className="space-y-2">
                    <FieldLabel>Monto mensual USD</FieldLabel>
                    <Input
                      min="0"
                      step="0.01"
                      type="number"
                      value={incomeForm.amountUsd}
                      onChange={(event) => setIncomeForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Primer ciclo</FieldLabel>
                    <Input
                      className={dateInputClassName}
                      type="date"
                      value={incomeForm.startDate}
                      onChange={(event) => setIncomeForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Fecha fin</FieldLabel>
                    <Input
                      className={dateInputClassName}
                      type="date"
                      value={incomeForm.endDate}
                      onChange={(event) => setIncomeForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    />
                  </div>
                </div>

                <p className="text-sm text-ink/52">Genera ocurrencias en el ledger sin duplicarlo.</p>

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
                <p className="mt-1 text-sm text-ink/54">Proyecto sigue siendo source of truth cuando aplica.</p>
              </div>
              <Select className="max-w-[220px]" value={incomeFilter} onChange={(event) => setIncomeFilter(event.target.value as SeriesFilter)}>
                <option value="ACTIVE">Activas</option>
                <option value="FINALIZED">Finalizadas</option>
                <option value="ALL">Todas</option>
              </Select>
            </div>

            {visibleIncomes.length === 0 ? (
              <EmptyState title="Sin series visibles" description="Cambiá el filtro o creá una serie manual." />
            ) : (
              <DataTable
                headers={["Cliente", "Proyecto", "Origen", "Monto USD", "Próx. ciclo", "Fecha fin", "Estado", "Acciones"]}
                scrollAfter={5}
                maxHeightClassName="max-h-[27rem]"
                tableClassName="min-w-[70rem] table-fixed"
                colGroup={
                  <colgroup>
                    <col className="w-[10rem]" />
                    <col className="w-[15rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[15rem]" />
                  </colgroup>
                }
              >
                {visibleIncomes.map((series) => (
                  <tr key={series.id}>
                    <td className="px-4 py-3 text-ink/72">{series.clientName}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{series.projectName}</div>
                      <div className="text-xs text-ink/48">{series.pendingCount} abiertas</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={series.source === "PROJECT" ? "success" : "neutral"}>{formatRecurringIncomeSource(series.source)}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{formatUsd(series.amountUsd)}</td>
                    <td className={cn("px-4 py-3", dateValueClassName)}>{formatShortDate(series.nextExpectedDate)}</td>
                    <td className={cn("px-4 py-3", dateValueClassName)}>{formatShortDate(series.endDate)}</td>
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
                          Proyecto
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

      <Card className="space-y-6">
        <SectionHeader
          tone="expense"
          title="Gastos recurrentes"
          description="Administrá la plantilla madre. El pago puntual sigue en Gastos."
          stats={[
            { label: "Activas", value: expenseSummary.activeCount, tone: "expense" },
            { label: "Fijos", value: expenseSummary.fixedCount, tone: "expense" },
            { label: "Variables", value: expenseSummary.variableCount, tone: "expense" },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[0.88fr,1.42fr]">
          <form className="space-y-4" onSubmit={handleCreateExpense}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo gasto recurrente</h2>
              <p className="mt-1 text-sm text-ink/54">Mensual; categoría obligatoria y proyecto opcional.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Categoría</FieldLabel>
                <Select value={expenseForm.categoryId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Proyecto</FieldLabel>
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr),12rem,12rem]">
              <div className="space-y-2">
                <FieldLabel>Tipo</FieldLabel>
                <Select value={expenseForm.expenseType} onChange={(event) => setExpenseForm((prev) => ({ ...prev, expenseType: event.target.value as ExpenseType }))}>
                  <option value="fixed">Fijo</option>
                  <option value="variable">Variable</option>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Monto mensual USD</FieldLabel>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={expenseForm.amountUsd}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Primer ciclo</FieldLabel>
                <Input
                  className={dateInputClassName}
                  type="date"
                  value={expenseForm.startDate}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Fecha fin</FieldLabel>
                <Input
                  className={dateInputClassName}
                  type="date"
                  value={expenseForm.endDate}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Descripción</FieldLabel>
              <Input
                placeholder="Opcional"
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <p className="text-sm text-ink/52">La serie genera ocurrencias en el ledger sin mostrar cada fila acá.</p>

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
                <p className="mt-1 text-sm text-ink/54">Vista de plantilla, no de operación diaria.</p>
              </div>
              <Select className="max-w-[220px]" value={expenseFilter} onChange={(event) => setExpenseFilter(event.target.value as SeriesFilter)}>
                <option value="ACTIVE">Activas</option>
                <option value="FINALIZED">Finalizadas</option>
                <option value="ALL">Todas</option>
              </Select>
            </div>

            {visibleExpenses.length === 0 ? (
              <EmptyState title="Sin series visibles" description="Cambiá el filtro o cargá una serie nueva." />
            ) : (
              <DataTable
                headers={["Categoría", "Descripción", "Proyecto", "Tipo", "Monto USD", "Próx. ciclo", "Fecha fin", "Estado", "Acciones"]}
                scrollAfter={5}
                maxHeightClassName="max-h-[27rem]"
                tableClassName="min-w-[74rem] table-fixed"
                colGroup={
                  <colgroup>
                    <col className="w-[12rem]" />
                    <col className="w-[12rem]" />
                    <col className="w-[12rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-[15rem]" />
                  </colgroup>
                }
              >
                {visibleExpenses.map((series) => (
                  <tr key={series.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{series.categoryName}</div>
                      <div className="text-xs text-ink/48">{series.pendingCount} abiertas</div>
                    </td>
                    <td className="px-4 py-3 text-ink/68">{series.description || "—"}</td>
                    <td className="px-4 py-3 text-ink/72">{series.projectName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={series.expenseType === "fixed" ? "neutral" : "danger"}>{formatExpenseType(series.expenseType)}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{formatUsd(series.amountUsd)}</td>
                    <td className={cn("px-4 py-3", dateValueClassName)}>{formatShortDate(series.nextDueDate)}</td>
                    <td className={cn("px-4 py-3", dateValueClassName)}>{formatShortDate(series.endDate)}</td>
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
                            Proyecto
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
        description="Los cambios impactan hacia adelante según el alcance."
        submitLabel="Guardar cambios"
        widthClassName="max-w-3xl"
        isPending={isPending}
        disabled={demoMode}
        error={incomeEditError}
        onClose={closeIncomeEditor}
        onSubmit={handleEditIncome}
      >
        {editingIncome && incomeEditForm ? (
          <div className="space-y-4">
            <div className="rounded-[1.2rem] border border-black/8 bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={editingIncome.source === "PROJECT" ? "success" : "neutral"}>{formatRecurringIncomeSource(editingIncome.source)}</Badge>
                <Badge tone={seriesTone(editingIncome.seriesStatus)}>{formatRecurringSeriesStatus(editingIncome.seriesStatus)}</Badge>
              </div>
              <div className="mt-3 text-lg font-semibold text-ink">{editingIncome.clientName} · {editingIncome.projectName}</div>
              <div className={cn("mt-1", dateValueClassName)}>Próx. ciclo: {formatShortDate(editingIncome.nextExpectedDate)}</div>
            </div>

            {editingIncome.source === "PROJECT" ? (
              <div className="rounded-[1.2rem] border border-emerald-900/15 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
                Si tocás futuros, también se actualiza el fee del proyecto.
              </div>
            ) : null}

            <div className="space-y-2">
              <FieldLabel>Alcance del cambio</FieldLabel>
              <Select value={incomeEditForm.scope} onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, scope: event.target.value as RecurrenceScope } : prev))}>
                {scopeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink/50">{scopeOptions.find((option) => option.value === incomeEditForm.scope)?.hint}</p>
            </div>

            {editingIncome.source === "MANUAL" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Cliente</FieldLabel>
                  <Select
                    disabled={incomeEditIsCurrentOnly}
                    value={incomeEditForm.clientId}
                    onChange={(event) => handleIncomeClientChange(event.target.value, "edit")}
                  >
                    {editIncomeClients.map((client) => (
                      <option key={client.clientId} value={client.clientId}>
                        {client.clientName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Proyecto</FieldLabel>
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
                  <FieldLabel>Cliente</FieldLabel>
                  <Input disabled value={editingIncome.clientName} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Proyecto</FieldLabel>
                  <Input disabled value={editingIncome.projectName} />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),12rem,12rem]">
              <div className="space-y-2">
                <FieldLabel>Monto mensual USD</FieldLabel>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={incomeEditForm.amountUsd}
                  onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, amountUsd: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Primer ciclo</FieldLabel>
                <Input
                  className={dateInputClassName}
                  disabled={editingIncome.source === "PROJECT" || incomeEditIsCurrentOnly}
                  type="date"
                  value={incomeEditForm.startDate}
                  onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, startDate: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Fecha fin</FieldLabel>
                <Input
                  className={dateInputClassName}
                  disabled={incomeEditIsCurrentOnly}
                  type="date"
                  value={incomeEditForm.endDate}
                  onChange={(event) => setIncomeEditForm((prev) => (prev ? { ...prev, endDate: event.target.value } : prev))}
                />
              </div>
            </div>

            {incomeEditIsCurrentOnly ? (
              <div className="rounded-[1.2rem] border border-amber-950/15 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                Solo cambia el próximo ciclo abierto; la serie madre queda igual.
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
        description="Los cambios impactan hacia adelante según el alcance."
        submitLabel="Guardar cambios"
        widthClassName="max-w-3xl"
        isPending={isPending}
        disabled={demoMode}
        error={expenseEditError}
        onClose={closeExpenseEditor}
        onSubmit={handleEditExpense}
      >
        {editingExpense && expenseEditForm ? (
          <div className="space-y-4">
            <div className="rounded-[1.2rem] border border-black/8 bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={editingExpense.expenseType === "fixed" ? "neutral" : "danger"}>{formatExpenseType(editingExpense.expenseType)}</Badge>
                <Badge tone={seriesTone(editingExpense.seriesStatus)}>{formatRecurringSeriesStatus(editingExpense.seriesStatus)}</Badge>
              </div>
              <div className="mt-3 text-lg font-semibold text-ink">{editingExpense.categoryName}</div>
              <div className={cn("mt-1", dateValueClassName)}>Próx. ciclo: {formatShortDate(editingExpense.nextDueDate)}</div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Alcance del cambio</FieldLabel>
              <Select value={expenseEditForm.scope} onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, scope: event.target.value as RecurrenceScope } : prev))}>
                {scopeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink/50">{scopeOptions.find((option) => option.value === expenseEditForm.scope)?.hint}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Categoría</FieldLabel>
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
                <FieldLabel>Proyecto</FieldLabel>
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr),12rem,12rem]">
              <div className="space-y-2">
                <FieldLabel>Tipo</FieldLabel>
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
                <FieldLabel>Monto mensual USD</FieldLabel>
                <Input
                  min="0"
                  step="0.01"
                  type="number"
                  value={expenseEditForm.amountUsd}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, amountUsd: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Primer ciclo</FieldLabel>
                <Input
                  className={dateInputClassName}
                  disabled={expenseEditIsCurrentOnly}
                  type="date"
                  value={expenseEditForm.startDate}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, startDate: event.target.value } : prev))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Fecha fin</FieldLabel>
                <Input
                  className={dateInputClassName}
                  disabled={expenseEditIsCurrentOnly}
                  type="date"
                  value={expenseEditForm.endDate}
                  onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, endDate: event.target.value } : prev))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Descripción</FieldLabel>
              <Input
                disabled={expenseEditIsCurrentOnly}
                value={expenseEditForm.description}
                onChange={(event) => setExpenseEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
              />
            </div>

            {expenseEditIsCurrentOnly ? (
              <div className="rounded-[1.2rem] border border-amber-950/15 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                Solo cambia el próximo gasto abierto; la plantilla queda igual.
              </div>
            ) : null}
          </div>
        ) : null}
      </EditEntityModal>

      <ConfirmActionModal
        open={Boolean(finalizeTarget)}
        title={finalizeTarget?.kind === "income" ? "Finalizar ingreso recurrente" : "Finalizar gasto recurrente"}
        description="Se detienen los futuros ciclos sin tocar históricos conciliados."
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
