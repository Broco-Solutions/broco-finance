"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  IncomeLedgerStatus,
  IncomeOrigin,
  IncomeRecord,
  IncomeStatus,
  IncomeType,
  ProjectRecord,
  ScheduledPaymentRecord,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { cn, formatArs, formatIncomeStatus, formatIncomeType, formatProjectStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statusSegments: Array<{ value: IncomeStatus; label: string; hint: string }> = [
  { value: "PAID", label: "Inmediato", hint: "Entra hoy en caja" },
  { value: "PENDING", label: "Pendiente", hint: "Queda por cobrar" },
];

const typeSegments: Array<{ value: IncomeType; label: string; hint: string }> = [
  { value: "DEVELOPMENT", label: "Desarrollo", hint: "Impacta el avance del build" },
  { value: "MAINTENANCE", label: "Mantenimiento", hint: "Se toma como fee operativo" },
];

type IncomeFormState = {
  projectId: string;
  date: string;
  dueDate: string;
  status: IncomeStatus;
  type: IncomeType;
  amountUsd: string;
  amountArs: string;
  exchangeRate: string;
  notes: string;
};

type LedgerIncomeRow = {
  id: string;
  rowKey: string;
  rowKind: "INCOME" | "SCHEDULED";
  origin: IncomeOrigin;
  projectId: string;
  projectName: string;
  clientName: string;
  date: string;
  dueDate: string | null;
  amountUsd: number;
  amountArs: number | null;
  exchangeRate: number | null;
  status: IncomeStatus;
  displayStatus: IncomeLedgerStatus;
  type: IncomeType;
  notes: string | null;
  income: IncomeRecord | null;
  scheduledPayment: ScheduledPaymentRecord | null;
};

function statusChip(status: IncomeLedgerStatus) {
  if (status === "PAID") {
    return "border-emerald-900/20 bg-emerald-50 text-emerald-950";
  }

  if (status === "OVERDUE") {
    return "border-brick/20 bg-rose-50 text-brick";
  }

  return "border-amber-900/20 bg-amber-50 text-amber-950";
}

function originChip(origin: IncomeOrigin) {
  return origin === "RECURRENT"
    ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
    : "border-black/10 bg-white text-ink/72";
}

function statusRowClassName(status: IncomeLedgerStatus) {
  if (status === "OVERDUE") {
    return "bg-rose-50/70";
  }

  if (status === "PENDING") {
    return "bg-amber-50/60";
  }

  return undefined;
}

function typeChip(type: IncomeType) {
  return type === "DEVELOPMENT"
    ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
    : "border-emerald-900/20 bg-emerald-50 text-emerald-950";
}

function isClosedProject(status: ProjectRecord["status"]) {
  return status === "COMPLETED" || status === "CANCELLED";
}

function isOpenScheduledPayment(payment: ScheduledPaymentRecord) {
  return payment.status === "pending" || payment.status === "overdue";
}

function mapScheduledPaymentStatus(status: ScheduledPaymentRecord["status"]): IncomeLedgerStatus {
  return status === "overdue" ? "OVERDUE" : "PENDING";
}

function formatOrigin(origin: IncomeOrigin) {
  return origin === "RECURRENT" ? "Recurrente" : "Manual";
}

function buildEmptyForm(projects: ProjectRecord[]): IncomeFormState {
  return {
    projectId: projects[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "PAID",
    type: "DEVELOPMENT",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  };
}

function buildIncomePayload(form: IncomeFormState, editingIncomeId: string | null) {
  return {
    projectId: form.projectId,
    date: form.date,
    dueDate: editingIncomeId ? (form.dueDate || null) : form.status === "PENDING" ? form.dueDate || null : null,
    status: form.status,
    type: form.type,
    amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
    amountArs: form.amountArs ? Number(form.amountArs) : null,
    exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
    notes: form.notes || null,
  };
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
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

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

function sortLedgerRows(rows: LedgerIncomeRow[]) {
  return [...rows].sort((left, right) => {
    const leftOpen = left.displayStatus !== "PAID";
    const rightOpen = right.displayStatus !== "PAID";

    if (leftOpen !== rightOpen) {
      return leftOpen ? -1 : 1;
    }

    if (leftOpen && rightOpen) {
      const byDue = (left.dueDate ?? left.date).localeCompare(right.dueDate ?? right.date);
      if (byDue !== 0) {
        return byDue;
      }
    }

    const byDate = right.date.localeCompare(left.date);
    if (byDate !== 0) {
      return byDate;
    }

    return left.projectName.localeCompare(right.projectName);
  });
}

export function IncomesScreen({
  incomes,
  scheduledPayments,
  projects,
  demoMode,
}: {
  incomes: IncomeRecord[];
  scheduledPayments: ScheduledPaymentRecord[];
  projects: ProjectRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<IncomeLedgerStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<IncomeType | "">("");
  const [originFilter, setOriginFilter] = useState<IncomeOrigin | "">("");
  const [clientFilter, setClientFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<IncomeFormState>(buildEmptyForm(projects));

  const ledgerRows = useMemo<LedgerIncomeRow[]>(
    () =>
      sortLedgerRows([
        ...incomes.map((income) => ({
          id: income.id,
          rowKey: `income:${income.id}`,
          rowKind: "INCOME" as const,
          origin: income.origin,
          projectId: income.projectId,
          projectName: income.projectName,
          clientName: income.clientName,
          date: income.date,
          dueDate: income.dueDate,
          amountUsd: income.amountUsd,
          amountArs: income.amountArs,
          exchangeRate: income.exchangeRate,
          status: income.status,
          displayStatus: income.displayStatus,
          type: income.type,
          notes: income.notes,
          income,
          scheduledPayment: null,
        })),
        ...scheduledPayments
          .filter(isOpenScheduledPayment)
          .map((payment) => ({
            id: payment.id,
            rowKey: `scheduled:${payment.id}`,
            rowKind: "SCHEDULED" as const,
            origin: "RECURRENT" as const,
            projectId: payment.projectId,
            projectName: payment.projectName,
            clientName: payment.clientName,
            date: payment.expectedDate,
            dueDate: payment.expectedDate,
            amountUsd: payment.expectedAmountUsd,
            amountArs: null,
            exchangeRate: null,
            status: "PENDING" as const,
            displayStatus: mapScheduledPaymentStatus(payment.status),
            type: payment.type,
            notes: payment.notes,
            income: null,
            scheduledPayment: payment,
          })),
      ]),
    [incomes, scheduledPayments],
  );

  const visibleIncomes = useMemo(
    () =>
      ledgerRows.filter((income) => {
        if (statusFilter && income.displayStatus !== statusFilter) {
          return false;
        }
        if (typeFilter && income.type !== typeFilter) {
          return false;
        }
        if (originFilter && income.origin !== originFilter) {
          return false;
        }
        if (clientFilter && income.clientName !== clientFilter) {
          return false;
        }
        if (projectFilter && income.projectId !== projectFilter) {
          return false;
        }
        return true;
      }),
    [clientFilter, ledgerRows, originFilter, projectFilter, statusFilter, typeFilter],
  );

  const summary = useMemo(
    () => ({
      paidUsd: incomes.filter((income) => income.displayStatus === "PAID").reduce((sum, income) => sum + income.amountUsd, 0),
      openUsd: ledgerRows.filter((income) => income.displayStatus !== "PAID").reduce((sum, income) => sum + income.amountUsd, 0),
      developmentPaidUsd: incomes
        .filter((income) => income.displayStatus === "PAID" && income.type === "DEVELOPMENT")
        .reduce((sum, income) => sum + income.amountUsd, 0),
      maintenancePaidUsd: incomes
        .filter((income) => income.displayStatus === "PAID" && income.type === "MAINTENANCE")
        .reduce((sum, income) => sum + income.amountUsd, 0),
    }),
    [incomes, ledgerRows],
  );

  const filteredTotals = useMemo(
    () => ({
      count: visibleIncomes.length,
      amountUsd: visibleIncomes.reduce((sum, income) => sum + income.amountUsd, 0),
      amountArs: visibleIncomes.reduce((sum, income) => sum + (income.amountArs ?? 0), 0),
    }),
    [visibleIncomes],
  );

  const clientOptions = useMemo(
    () => Array.from(new Set(ledgerRows.map((income) => income.clientName))).sort((left, right) => left.localeCompare(right)),
    [ledgerRows],
  );

  const projectOptions = useMemo(
    () =>
      [...projects]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((project) => ({
          id: project.id,
          label: `${project.clientName} · ${project.name}`,
        })),
    [projects],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? null,
    [projects, form.projectId],
  );

  const editingIncome = useMemo(
    () => incomes.find((income) => income.id === editingIncomeId) ?? null,
    [editingIncomeId, incomes],
  );

  const pendingIncomeBlocked = form.status === "PENDING" && Boolean(selectedProject && isClosedProject(selectedProject.status));

  const resetForm = () => {
    setEditingIncomeId(null);
    setDeleteDialogOpen(false);
    setDeleteError(null);
    setError(null);
    setForm(buildEmptyForm(projects));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(editingIncomeId ? `/api/incomes/${editingIncomeId}` : "/api/incomes", {
          method: editingIncomeId ? "PUT" : "POST",
          body: JSON.stringify(buildIncomePayload(form, editingIncomeId)),
        });

        resetForm();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el ingreso.");
      }
    });
  };

  const handleEdit = (income: IncomeRecord) => {
    if (income.origin === "RECURRENT") {
      return;
    }

    setEditingIncomeId(income.id);
    setDeleteDialogOpen(false);
    setDeleteError(null);
    setError(null);
    setForm({
      projectId: income.projectId,
      date: income.date,
      dueDate: income.dueDate ?? "",
      status: income.status,
      type: income.type,
      amountUsd: income.amountUsd ? String(income.amountUsd) : "",
      amountArs: income.amountArs ? String(income.amountArs) : "",
      exchangeRate: income.exchangeRate ? String(income.exchangeRate) : "",
      notes: income.notes ?? "",
    });
  };

  const handleMarkPaid = (income: IncomeRecord) => {
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(`/api/incomes/${income.id}`, {
          method: "PUT",
          body: JSON.stringify({
            projectId: income.projectId,
            date: new Date().toISOString().slice(0, 10),
            dueDate: income.dueDate,
            status: "PAID",
            type: income.type,
            amountUsd: income.amountUsd,
            amountArs: income.amountArs,
            exchangeRate: income.exchangeRate,
            notes: income.notes,
          }),
        });

        if (editingIncomeId === income.id) {
          resetForm();
        }

        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el cobro.");
      }
    });
  };

  const handleDelete = () => {
    if (!editingIncomeId) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteError(null);
        await apiFetch(`/api/incomes/${editingIncomeId}`, { method: "DELETE" });
        resetForm();
        router.refresh();
      } catch (submitError) {
        setDeleteError(submitError instanceof Error ? submitError.message : "No se pudo eliminar el ingreso.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Ingresos" title="Ingresos" description="" demoMode={demoMode} />

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="border-emerald-950/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/78">Cobrado real</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.paidUsd)}</div>
          <p className="mt-2 text-sm text-emerald-50/88">Caja efectivamente cobrada.</p>
        </Card>
        <Card className="border-amber-950/30 bg-gradient-to-br from-amber-950 via-amber-900 to-coral text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/80">Pendiente a cobrar</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.openUsd)}</div>
          <p className="mt-2 text-sm text-amber-50/90">Incluye manuales abiertos y ocurrencias recurrentes pendientes o vencidas.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt">Desarrollo cobrado</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.developmentPaidUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Este monto sí descuenta saldo del build inicial.</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950">Mantenimiento cobrado</div>
          <div className="mt-3 font-display text-4xl text-ink">{formatUsd(summary.maintenancePaidUsd)}</div>
          <p className="mt-2 text-sm text-ink/60">Suma caja, pero no altera el saldo del desarrollo.</p>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">{editingIncomeId ? "Editar ingreso" : "Nuevo ingreso"}</h2>
              <p className="mt-1 text-sm text-ink/55">
                Clasificá el cobro por naturaleza financiera antes de guardarlo. Esa decisión impacta el avance del desarrollo, no la caja total.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SegmentedControl
                label="Temporalidad"
                value={form.status}
                options={statusSegments}
                activeToneClassName={form.status === "PAID" ? "bg-emerald-700" : "bg-amber-700"}
                onChange={(status) =>
                  setForm((prev) => ({
                    ...prev,
                    status,
                    dueDate: status === "PENDING" ? prev.dueDate || prev.date : prev.dueDate,
                  }))
                }
              />
              <SegmentedControl
                label="Naturaleza"
                value={form.type}
                options={typeSegments}
                activeToneClassName={form.type === "DEVELOPMENT" ? "bg-cobalt" : "bg-emerald-700"}
                onChange={(type) => setForm((prev) => ({ ...prev, type }))}
              />
            </div>

            <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              {projects.map((project) => (
                <option key={project.id} disabled={form.status === "PENDING" && isClosedProject(project.status)} value={project.id}>
                  {project.clientName} · {project.name} · {formatProjectStatus(project.status)}
                </option>
              ))}
            </Select>

            {pendingIncomeBlocked ? (
              <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-brick">
                El proyecto seleccionado está {formatProjectStatus(selectedProject?.status).toLowerCase()}.
                Para evitar deuda abierta sobre proyectos cerrados, los ingresos `PENDING` siguen bloqueados.
              </div>
            ) : null}

            {selectedProject && form.type === "MAINTENANCE" ? (
              <div className="rounded-[1.2rem] border border-emerald-900/15 bg-emerald-50/60 px-4 py-3 text-sm text-ink/75">
                Fee actual del proyecto: <span className="font-semibold text-ink">{formatUsd(selectedProject.monthlyFeeUsd)}</span>.
              </div>
            ) : null}

            <div className={`grid gap-4 ${form.status === "PENDING" || (editingIncomeId && form.dueDate) ? "md:grid-cols-2" : ""}`}>
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
              {form.status !== "PENDING" && editingIncomeId && form.dueDate ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Vence original</label>
                  <Input disabled type="date" value={form.dueDate} />
                </div>
              ) : null}
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

            <Textarea
              placeholder={
                form.type === "DEVELOPMENT"
                  ? "Hito, adelanto o saldo del desarrollo"
                  : "Mes liquidado, abono o mantenimiento"
              }
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />

            {error ? <p className="text-sm text-brick">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isPending || demoMode || pendingIncomeBlocked}>
                {demoMode
                  ? "Requiere DATABASE_URL"
                  : isPending
                    ? "Guardando…"
                    : editingIncomeId
                      ? "Guardar cambios"
                      : "Registrar ingreso"}
              </Button>
              {editingIncomeId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar edición
                </Button>
              ) : null}
              {editingIncomeId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-brick hover:bg-brick/10 hover:text-brick"
                  disabled={isPending || demoMode}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteDialogOpen(true);
                  }}
                >
                  Eliminar ingreso
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Ledger de ingresos</h2>
              <p className="mt-1 text-sm text-ink/55">
                El operativo global ahora mezcla ingresos manuales y ocurrencias recurrentes abiertas sin duplicar la serie madre.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Select className="max-w-[220px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as IncomeLedgerStatus | "")}>
                <option value="">Todos los estados</option>
                <option value="PAID">Cobrado</option>
                <option value="PENDING">Pendiente</option>
                <option value="OVERDUE">Vencido</option>
              </Select>
              <Select className="max-w-[220px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as IncomeType | "")}>
                <option value="">Todos los tipos</option>
                <option value="DEVELOPMENT">Desarrollo</option>
                <option value="MAINTENANCE">Mantenimiento</option>
              </Select>
              <Select className="max-w-[220px]" value={originFilter} onChange={(event) => setOriginFilter(event.target.value as IncomeOrigin | "")}>
                <option value="">Origen: Todos</option>
                <option value="RECURRENT">Origen: Recurrente</option>
              </Select>
              <Select className="max-w-[220px]" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                <option value="">Todos los clientes</option>
                {clientOptions.map((clientName) => (
                  <option key={clientName} value={clientName}>
                    {clientName}
                  </option>
                ))}
              </Select>
              <Select className="max-w-[260px]" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value="">Todos los proyectos</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-emerald-900/10 bg-[linear-gradient(90deg,rgba(236,253,245,0.92),rgba(248,250,252,0.96))] px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-950/70">Total filtrado</div>
              <div className="mt-1 text-sm text-ink/60">{filteredTotals.count} movimientos visibles</div>
            </div>
            <div className="flex flex-wrap gap-6 text-right">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">ARS</div>
                <div className="mt-1 font-semibold text-ink">{formatArs(filteredTotals.amountArs)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">USD</div>
                <div className="mt-1 font-display text-2xl text-emerald-950">{formatUsd(filteredTotals.amountUsd)}</div>
              </div>
            </div>
          </div>

          {visibleIncomes.length === 0 ? (
            <EmptyState title="Sin ingresos" description="No hay filas que coincidan con los filtros activos en el ledger." />
          ) : (
            <DataTable
              headers={["Fecha", "Vence", "Origen", "Cliente", "Proyecto", "Tipo", "USD", "Estado", "Notas", "Acción"]}
              tableClassName="min-w-[78rem] table-fixed"
              colGroup={
                <colgroup>
                  <col className="w-[8rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[10rem]" />
                  <col className="w-[14rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[15rem]" />
                  <col className="w-[11rem]" />
                </colgroup>
              }
              footer={
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink" colSpan={6}>
                    Total filtrado
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-950">{formatUsd(filteredTotals.amountUsd)}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/45">{filteredTotals.count} filas</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                </tr>
              }
            >
              {visibleIncomes.map((income) => (
                <tr key={income.rowKey} className={statusRowClassName(income.displayStatus)}>
                  <td className="px-4 py-3">{formatShortDate(income.date)}</td>
                  <td className="px-4 py-3">{formatShortDate(income.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${originChip(income.origin)}`}>
                      {formatOrigin(income.origin)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{income.clientName}</td>
                  <td className="px-4 py-3">{income.projectName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${typeChip(income.type)}`}>
                      {formatIncomeType(income.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatUsd(income.amountUsd)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusChip(income.displayStatus)}`}>
                      {formatIncomeStatus(income.displayStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{income.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    {income.rowKind === "SCHEDULED" && income.scheduledPayment ? (
                      <MarkPaymentPaidButton
                        paymentId={income.scheduledPayment.id}
                        expectedDate={income.scheduledPayment.expectedDate}
                        paymentStatus={income.scheduledPayment.status}
                        paymentType={income.scheduledPayment.type}
                        expectedAmountUsd={income.scheduledPayment.expectedAmountUsd}
                        projectName={income.scheduledPayment.projectName}
                        demoMode={demoMode}
                        compact
                      />
                    ) : income.income ? (
                      <div className="flex flex-wrap gap-2">
                        {income.income.origin === "MANUAL" ? (
                          <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => handleEdit(income.income!)}>
                            Editar
                          </Button>
                        ) : null}
                        {income.income.displayStatus !== "PAID" ? (
                          <Button
                            type="button"
                            className="px-3 py-1.5 text-xs"
                            disabled={isPending || demoMode}
                            onClick={() => handleMarkPaid(income.income!)}
                          >
                            {demoMode ? "Demo" : isPending ? "Registrando…" : "Marcar cobrado"}
                          </Button>
                        ) : null}
                        {income.income.origin === "RECURRENT" && income.income.displayStatus === "PAID" ? (
                          <span className="text-xs text-ink/45">Gestionado desde la ocurrencia.</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-ink/45">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <ConfirmActionModal
        open={deleteDialogOpen}
        title="Eliminar ingreso"
        description="Esta acción borra el ingreso de forma definitiva y recalcula el dashboard, los totales y los acumulados que dependan de él."
        confirmLabel="Eliminar ingreso"
        isPending={isPending}
        disabled={demoMode}
        error={deleteError}
        onClose={() => {
          setDeleteError(null);
          setDeleteDialogOpen(false);
        }}
        onConfirm={handleDelete}
      >
        {editingIncome ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Proyecto: <span className="font-semibold text-ink">{editingIncome.clientName} · {editingIncome.projectName}</span>.
            </p>
            <p>
              Tipo y estado:{" "}
              <span className="font-semibold text-ink">
                {formatIncomeType(editingIncome.type)} · {formatIncomeStatus(editingIncome.displayStatus)}
              </span>
              .
            </p>
            <p>
              Importe: <span className="font-semibold text-ink">{formatUsd(editingIncome.amountUsd)}</span>.
            </p>
            <p className="text-ink/60">Si el ingreso está conciliado con un pago programado, el sistema va a bloquear la eliminación.</p>
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
