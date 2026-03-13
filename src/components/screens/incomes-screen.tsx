"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeRecord, IncomeStatus, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatArs, formatIncomeStatus, formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const incomeStatuses: IncomeStatus[] = ["PAID", "PENDING"];

function statusChip(status: IncomeStatus) {
  return status === "PAID"
    ? "border-emerald-900/20 bg-emerald-50 text-emerald-950"
    : "border-amber-900/20 bg-amber-50 text-amber-950";
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
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    status: "PAID" as IncomeStatus,
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  });

  const visibleIncomes = useMemo(
    () => (statusFilter ? incomes.filter((income) => income.status === statusFilter) : incomes),
    [incomes, statusFilter],
  );

  const summary = useMemo(
    () => ({
      paidUsd: incomes.filter((income) => income.status === "PAID").reduce((sum, income) => sum + income.amountUsd, 0),
      pendingUsd: incomes.filter((income) => income.status === "PENDING").reduce((sum, income) => sum + income.amountUsd, 0),
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

  const resetForm = () => {
    setEditingIncomeId(null);
    setForm({
      projectId: projects[0]?.id ?? "",
      date: new Date().toISOString().slice(0, 10),
      status: "PAID",
      amountUsd: "",
      amountArs: "",
      exchangeRate: "",
      notes: "",
    });
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
        title="Caja real y cuentas por cobrar, sin tipos artificiales"
        description="Elegís si el dinero ya entró o si todavía es una promesa de cobro. Solo lo cobrado alimenta resultado neto, remanente y gráficos."
        demoMode={demoMode}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-emerald-950/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-700 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/78">Cobrado real</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.paidUsd)}</div>
          <p className="mt-2 text-sm text-emerald-50/88">Participa en KPIs, gráficos, resultado neto y remanente.</p>
        </Card>
        <Card className="border-amber-950/30 bg-gradient-to-br from-amber-950 via-amber-900 to-coral text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/80">Pendiente a cobrar</div>
          <div className="mt-3 font-display text-4xl text-white">{formatUsd(summary.pendingUsd)}</div>
          <p className="mt-2 text-sm text-amber-50/90">Se muestra como cuenta por cobrar, pero no toca caja hasta marcarse cobrado.</p>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">{editingIncomeId ? "Editar ingreso" : "Nuevo ingreso"}</h2>
              <p className="mt-1 text-sm text-ink/55">
                {form.status === "PAID"
                  ? "Usalo para dinero que ya entró a caja."
                  : "Usalo para cuotas, hitos o compromisos que todavía no cobraron."}
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
                      {status === "PAID"
                        ? "Entra hoy en métricas de caja."
                        : "Queda visible como cuenta por cobrar hasta cobrarlo."}
                    </div>
                  </button>
                );
              })}
            </div>

            <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </Select>

            <Input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />

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
              placeholder={form.status === "PAID" ? "Notas del cobro real" : "Detalle del pendiente, cuota o hito"}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />

            {error ? <p className="text-sm text-brick">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isPending || demoMode}>
                {demoMode
                  ? "Requiere DATABASE_URL"
                  : isPending
                    ? "Guardando…"
                    : editingIncomeId
                      ? "Guardar cambios"
                      : form.status === "PAID"
                        ? "Registrar cobro"
                        : "Registrar pendiente"}
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
              <p className="mt-1 text-sm text-ink/55">Los pendientes se pueden editar antes de cobrarse. Cuando pasan a cobrado, recién ahí entran en caja.</p>
            </div>
            <Select className="max-w-[220px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="PAID">Cobrado</option>
              <option value="PENDING">Pendiente</option>
            </Select>
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
            <EmptyState title="Sin ingresos" description="Cargá cobros reales o pendientes a futuro para empezar a seguir caja y cuentas por cobrar." />
          ) : (
            <DataTable
              headers={["Fecha", "Cliente", "Proyecto", "ARS", "USD", "Estado", "Notas", "Acción"]}
              footer={
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink" colSpan={3}>
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
