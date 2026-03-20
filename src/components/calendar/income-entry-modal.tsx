"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeRecord, IncomeStatus, IncomeType, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatProjectStatus } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type IncomeFormState = {
  amountArs: string;
  amountUsd: string;
  date: string;
  dueDate: string;
  exchangeRate: string;
  notes: string;
  projectId: string;
  status: IncomeStatus;
  type: IncomeType;
};

function buildIncomeForm({
  date,
  income,
  projects,
}: {
  date: string;
  income: IncomeRecord | null;
  projects: ProjectRecord[];
}): IncomeFormState {
  if (income) {
    return {
      projectId: income.projectId,
      date: income.date,
      dueDate: income.dueDate ?? "",
      status: income.status,
      type: income.type,
      amountUsd: income.amountUsd ? String(income.amountUsd) : "",
      amountArs: income.amountArs ? String(income.amountArs) : "",
      exchangeRate: income.exchangeRate ? String(income.exchangeRate) : "",
      notes: income.notes ?? "",
    };
  }

  return {
    projectId: projects[0]?.id ?? "",
    date,
    dueDate: date,
    status: "PENDING",
    type: "DEVELOPMENT",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  };
}

function isClosedProject(status: ProjectRecord["status"]) {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function IncomeEntryModal({
  date,
  demoMode,
  income,
  lockedReason,
  onClose,
  open,
  projects,
}: {
  date: string;
  demoMode: boolean;
  income: IncomeRecord | null;
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
  const [form, setForm] = useState<IncomeFormState>(() => buildIncomeForm({ income, date, projects }));

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setDeleteError(null);
    setDeleteDialogOpen(false);
    setForm(buildIncomeForm({ income, date, projects }));
  }, [date, income, open, projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? null,
    [form.projectId, projects],
  );

  const lockedIncome = Boolean(lockedReason);
  const pendingIncomeBlocked = form.status === "PENDING" && Boolean(selectedProject && isClosedProject(selectedProject.status));
  const submitDisabled = demoMode || isPending || pendingIncomeBlocked || lockedIncome || !form.projectId || projects.length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(income ? `/api/incomes/${income.id}` : "/api/incomes", {
          method: income ? "PUT" : "POST",
          body: JSON.stringify({
            projectId: form.projectId,
            date: form.date,
            dueDate: income ? (form.dueDate || null) : form.status === "PENDING" ? form.dueDate || null : null,
            status: form.status,
            type: form.type,
            amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
            amountArs: form.amountArs ? Number(form.amountArs) : null,
            exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
            notes: form.notes || null,
          }),
        });
        onClose();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el ingreso.");
      }
    });
  };

  const handleMarkPaid = () => {
    if (!income) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await apiFetch(`/api/incomes/${income.id}`, {
          method: "PUT",
          body: JSON.stringify({
            projectId: form.projectId,
            date: new Date().toISOString().slice(0, 10),
            dueDate: form.dueDate || null,
            status: "PAID",
            type: form.type,
            amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
            amountArs: form.amountArs ? Number(form.amountArs) : null,
            exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
            notes: form.notes || null,
          }),
        });
        onClose();
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el cobro.");
      }
    });
  };

  const handleDelete = () => {
    if (!income) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteError(null);
        await apiFetch(`/api/incomes/${income.id}`, { method: "DELETE" });
        setDeleteDialogOpen(false);
        onClose();
        router.refresh();
      } catch (submitError) {
        setDeleteError(submitError instanceof Error ? submitError.message : "No se pudo eliminar el ingreso.");
      }
    });
  };

  return (
    <>
      <EditEntityModal
        open={open}
        title={income ? "Editar ingreso" : "Nuevo ingreso"}
        description={
          income
            ? "Ajustá monto, fecha o estado sin salir del calendario."
            : "Creá un ingreso con la fecha del día seleccionada y dejalo listo para cobrar o conciliar."
        }
        submitLabel={income ? "Guardar ingreso" : "Crear ingreso"}
        isPending={isPending}
        disabled={submitDisabled}
        error={error}
        onClose={onClose}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Estado</label>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as IncomeStatus,
                    dueDate: event.target.value === "PENDING" ? prev.dueDate || prev.date : prev.dueDate,
                  }))
                }
              >
                <option value="PENDING">Pendiente</option>
                <option value="PAID">Cobrado</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Naturaleza</label>
              <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as IncomeType }))}>
                <option value="DEVELOPMENT">Desarrollo</option>
                <option value="MAINTENANCE">Mantenimiento</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Proyecto</label>
            <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              {projects.length === 0 ? <option value="">Sin proyectos disponibles</option> : null}
              {projects.map((project) => (
                <option key={project.id} disabled={form.status === "PENDING" && isClosedProject(project.status)} value={project.id}>
                  {project.clientName} · {project.name} · {formatProjectStatus(project.status)}
                </option>
              ))}
            </Select>
          </div>

          {pendingIncomeBlocked ? (
            <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-brick">
              El proyecto está {formatProjectStatus(selectedProject?.status).toLowerCase()}. Un ingreso pendiente no puede quedar abierto sobre proyectos cerrados.
            </div>
          ) : null}

          <div className={`grid gap-3 ${form.status === "PENDING" || (income && form.dueDate) ? "sm:grid-cols-2" : ""}`}>
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
            {form.status !== "PENDING" && income && form.dueDate ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Vence original</label>
                <Input disabled type="date" value={form.dueDate} />
              </div>
            ) : null}
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

          {projects.length === 0 ? <p className="text-sm text-ink/55">Necesitás al menos un proyecto para registrar ingresos.</p> : null}

          {lockedIncome ? (
            <div className="rounded-[1.2rem] border border-black/10 bg-black/5 px-4 py-3 text-sm text-ink/70">{lockedReason}</div>
          ) : null}

          {income && !lockedIncome ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4">
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
                Eliminar ingreso
              </Button>
              {income.status === "PENDING" ? (
                <Button type="button" variant="secondary" disabled={demoMode || isPending} onClick={handleMarkPaid}>
                  {isPending ? "Registrando…" : "Marcar cobrado hoy"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </EditEntityModal>

      <ConfirmActionModal
        open={deleteDialogOpen}
        title="Eliminar ingreso"
        description="Esta acción borra el ingreso de forma definitiva y recalcula los resúmenes financieros que dependan de él."
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
        {income ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Proyecto: <span className="font-semibold text-ink">{income.clientName} · {income.projectName}</span>.
            </p>
            <p>
              Importe: <span className="font-semibold text-ink">{income.amountUsd.toFixed(2)} USD</span>.
            </p>
            <p className="text-ink/60">Si el ingreso está conciliado con un pago programado, el sistema va a bloquear la eliminación.</p>
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </>
  );
}
