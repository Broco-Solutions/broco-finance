"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeRecord, IncomeStatus, IncomeType, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatArs, formatIncomeStatus, formatIncomeType, formatProjectStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const incomeStatuses: IncomeStatus[] = ["PAID", "PENDING"];
const incomeTypes: IncomeType[] = ["DEVELOPMENT", "MAINTENANCE"];

function statusChip(status: IncomeStatus) {
  return status === "PAID"
    ? "border-emerald-900/20 bg-emerald-50 text-emerald-950"
    : "border-amber-900/20 bg-amber-50 text-amber-950";
}

function typeChip(type: IncomeType) {
  return type === "DEVELOPMENT"
    ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
    : "border-emerald-900/20 bg-emerald-50 text-emerald-950";
}

function isClosedProject(status: ProjectRecord["status"]) {
  return status === "COMPLETED" || status === "CANCELLED";
}

type IncomeFormState = {
  projectId: string;
  date: string;
  status: IncomeStatus;
  type: IncomeType;
  amountUsd: string;
  amountArs: string;
  exchangeRate: string;
  notes: string;
};

function buildEmptyForm(projects: ProjectRecord[]): IncomeFormState {
  return {
    projectId: projects[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    status: "PAID",
    type: "DEVELOPMENT",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  };
}

export function IncomesScreen({
  incomes,
  projects,
  demoMode,
}: {
  incomes: IncomeRecord[];
  projects: ProjectRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<IncomeFormState>(buildEmptyForm(projects));

  const visibleIncomes = useMemo(
    () =>
      incomes.filter((income) => {
        if (statusFilter && income.status !== statusFilter) {
          return false;
        }
        if (typeFilter && income.type !== typeFilter) {
          return false;
        }
        return true;
      }),
    [incomes, statusFilter, typeFilter],
  );

  const summary = useMemo(
    () => ({
      paidUsd: incomes.filter((income) => income.status === "PAID").reduce((sum, income) => sum + income.amountUsd, 0),
      pendingUsd: incomes.filter((income) => income.status === "PENDING").reduce((sum, income) => sum + income.amountUsd, 0),
      developmentPaidUsd: incomes
        .filter((income) => income.status === "PAID" && income.type === "DEVELOPMENT")
        .reduce((sum, income) => sum + income.amountUsd, 0),
      maintenancePaidUsd: incomes
        .filter((income) => income.status === "PAID" && income.type === "MAINTENANCE")
        .reduce((sum, income) => sum + income.amountUsd, 0),
    }),
    [incomes],
  );

  const filteredTotals = useMemo(
    () => ({
      count: visibleIncomes.length,
      amountUsd: visibleIncomes.reduce((sum, income) => sum + income.amountUsd, 0),
      amountArs: visibleIncomes.reduce((sum, income) => sum + (income.amountArs ?? 0), 0),
    }),
    [visibleIncomes],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? null,
    [projects, form.projectId],
  );

  const pendingIncomeBlocked = form.status === "PENDING" && Boolean(selectedProject && isClosedProject(selectedProject.status));

  const resetForm = () => {
    setEditingIncomeId(null);
    setForm(buildEmptyForm(projects));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        const payload = {
          projectId: form.projectId,
          date: form.date,
          status: form.status,
          type: form.type,
          amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
          amountArs: form.amountArs ? Number(form.amountArs) : null,
          exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
          notes: form.notes || null,
        };

        await apiFetch(editingIncomeId ? `/api/incomes/${editingIncomeId}` : "/api/incomes", {
          method: editingIncomeId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });

        resetForm();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el ingreso.");
      }
    });
  };

  const handleEdit = (income: IncomeRecord) => {
    setEditingIncomeId(income.id);
    setForm({
      projectId: income.projectId,
      date: income.date,
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ingresos"
        title="Caja real con origen claro: desarrollo o mantenimiento"
        description="Todo ingreso suma caja, pero ahora cada cobro se clasifica para no descontar mensualidades del saldo pendiente del desarrollo."
        demoMode={demoMode}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="border-emerald-950/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/78">Cobrado real</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.paidUsd)}</div>
          <p className="mt-2 text-sm text-emerald-50/88">Caja efectivamente cobrada.</p>
        </Card>
        <Card className="border-amber-950/30 bg-gradient-to-br from-amber-950 via-amber-900 to-coral text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/80">Pendiente a cobrar</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.pendingUsd)}</div>
          <p className="mt-2 text-sm text-amber-50/90">Cuenta por cobrar todavía abierta.</p>
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

            <div className="grid gap-3 sm:grid-cols-2">
              {incomeStatuses.map((status) => {
                const selected = form.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                      selected
                        ? status === "PAID"
                          ? "border-emerald-900/20 bg-emerald-50 text-emerald-950"
                          : "border-amber-900/20 bg-amber-50 text-amber-950"
                        : "border-black/10 bg-white/75 text-ink hover:bg-black/5"
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, status }))}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em]">
                      {status === "PAID" ? "Cobro inmediato" : "Pendiente a futuro"}
                    </div>
                    <div className="mt-2 text-sm">
                      {status === "PAID" ? "Entra hoy en caja." : "Queda abierto como cuenta por cobrar."}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {incomeTypes.map((type) => {
                const selected = form.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                      selected
                        ? type === "DEVELOPMENT"
                          ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
                          : "border-emerald-900/20 bg-emerald-50 text-emerald-950"
                        : "border-black/10 bg-white/75 text-ink hover:bg-black/5"
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, type }))}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em]">{formatIncomeType(type)}</div>
                    <div className="mt-2 text-sm">
                      {type === "DEVELOPMENT"
                        ? "Descuenta saldo del presupuesto fijo."
                        : "Se trata como mensualidad o fee operativo."}
                    </div>
                  </button>
                );
              })}
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

            <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />

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
            </div>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Ledger de ingresos</h2>
              <p className="mt-1 text-sm text-ink/55">Cada fila conserva estado operativo y tipo financiero para no mezclar build con retainer.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select className="max-w-[220px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="PAID">Cobrado</option>
                <option value="PENDING">Pendiente</option>
              </Select>
              <Select className="max-w-[220px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Todos los tipos</option>
                <option value="DEVELOPMENT">Desarrollo</option>
                <option value="MAINTENANCE">Mantenimiento</option>
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
            <EmptyState title="Sin ingresos" description="Cargá cobros o pendientes y clasificá si corresponden a desarrollo o mantenimiento." />
          ) : (
            <DataTable
              headers={["Fecha", "Cliente", "Proyecto", "Tipo", "ARS", "USD", "Estado", "Notas", "Acción"]}
              footer={
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink" colSpan={4}>
                    Total filtrado
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatArs(filteredTotals.amountArs)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-950">{formatUsd(filteredTotals.amountUsd)}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/45">{filteredTotals.count} filas</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                  <td className="px-4 py-3 text-ink/45">—</td>
                </tr>
              }
            >
              {visibleIncomes.map((income) => (
                <tr key={income.id} className={income.status === "PENDING" ? "bg-amber-50/60" : undefined}>
                  <td className="px-4 py-3">{formatShortDate(income.date)}</td>
                  <td className="px-4 py-3">{income.clientName}</td>
                  <td className="px-4 py-3">{income.projectName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${typeChip(income.type)}`}>
                      {formatIncomeType(income.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatArs(income.amountArs)}</td>
                  <td className="px-4 py-3">{formatUsd(income.amountUsd)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusChip(income.status)}`}>
                      {formatIncomeStatus(income.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{income.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => handleEdit(income)}>
                        Editar
                      </Button>
                      {income.status === "PENDING" ? (
                        <Button
                          type="button"
                          className="px-3 py-1.5 text-xs"
                          disabled={isPending || demoMode}
                          onClick={() => handleMarkPaid(income)}
                        >
                          {demoMode ? "Demo" : isPending ? "Registrando…" : "Marcar cobrado"}
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
    </div>
  );
}
