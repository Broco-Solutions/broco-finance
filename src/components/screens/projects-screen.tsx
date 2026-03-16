"use client";

import Link from "next/link";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord, ProjectRecord, ProjectStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatProjectStatus, formatShortDate, formatUsd, toFixedCurrencyInput } from "@/lib/utils";
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

const statuses: ProjectStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];

type ProjectFormState = {
  clientId: string;
  name: string;
  status: ProjectStatus;
  devBudgetUsd: string;
  monthlyFeeUsd: string;
  monthlyFeeEndDate: string;
  notes: string;
};

function isClosedProject(status: ProjectStatus) {
  return status === "COMPLETED" || status === "CANCELLED";
}

function statusTone(status: ProjectStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "neutral" as const;
}

function actionButtonClass(tone: "neutral" | "danger" = "neutral") {
  return tone === "danger"
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brick/15 bg-brick/5 text-brick transition hover:bg-brick/10"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5";
}

function buildEmptyForm(clients: ClientRecord[]): ProjectFormState {
  return {
    clientId: clients[0]?.id ?? "",
    name: "",
    status: "ACTIVE",
    devBudgetUsd: "",
    monthlyFeeUsd: "",
    monthlyFeeEndDate: "",
    notes: "",
  };
}

function toPayload(form: ProjectFormState) {
  return {
    clientId: form.clientId,
    name: form.name,
    status: form.status,
    devBudgetUsd: form.devBudgetUsd ? Number(form.devBudgetUsd) : null,
    monthlyFeeUsd: form.monthlyFeeUsd ? Number(form.monthlyFeeUsd) : null,
    monthlyFeeEndDate: form.monthlyFeeEndDate || null,
    notes: form.notes || null,
  };
}

function developmentRatio(project: ProjectRecord) {
  if (!project.devBudgetUsd || project.devBudgetUsd <= 0) {
    return null;
  }

  return Math.min((project.developmentCollectedUsd / project.devBudgetUsd) * 100, 100);
}

export function ProjectsScreen({
  projects,
  clients,
  demoMode,
}: {
  projects: ProjectRecord[];
  clients: ClientRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState({ clientId: "", status: "" });
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [editForm, setEditForm] = useState<ProjectFormState>(buildEmptyForm(clients));
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(buildEmptyForm(clients));

  const visibleProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (filters.clientId && project.clientId !== filters.clientId) {
          return false;
        }
        if (filters.status && project.status !== filters.status) {
          return false;
        }
        return true;
      }),
    [projects, filters],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/projects", {
          method: "POST",
          body: JSON.stringify(toPayload(form)),
        });
        setForm((prev) => ({ ...buildEmptyForm(clients), clientId: prev.clientId || clients[0]?.id || "" }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el proyecto.");
      }
    });
  };

  const openEditModal = (project: ProjectRecord) => {
    setEditingProject(project);
    setEditForm({
      clientId: project.clientId,
      name: project.name,
      status: project.status,
      devBudgetUsd: toFixedCurrencyInput(project.devBudgetUsd),
      monthlyFeeUsd: toFixedCurrencyInput(project.monthlyFeeUsd),
      monthlyFeeEndDate: project.monthlyFeeEndDate ?? "",
      notes: project.notes ?? "",
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingProject(null);
    setEditForm(buildEmptyForm(clients));
    setEditError(null);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingProject) {
      return;
    }

    startTransition(async () => {
      try {
        setEditError(null);
        await apiFetch(`/api/projects/${editingProject.id}`, {
          method: "PUT",
          body: JSON.stringify(toPayload(editForm)),
        });
        closeEditModal();
        router.refresh();
      } catch (submitError) {
        setEditError(submitError instanceof Error ? submitError.message : "No se pudo actualizar el proyecto.");
      }
    });
  };

  const openDeleteModal = (project: ProjectRecord) => {
    setDeletingProject(project);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setDeletingProject(null);
    setDeleteError(null);
  };

  const handleDelete = () => {
    if (!deletingProject) {
      return;
    }

    startTransition(async () => {
      try {
        setDeleteError(null);
        await apiFetch(`/api/projects/${deletingProject.id}`, {
          method: "DELETE",
        });
        closeDeleteModal();
        router.refresh();
      } catch (submitError) {
        setDeleteError(submitError instanceof Error ? submitError.message : "No se pudo eliminar el proyecto.");
      }
    });
  };

  const showPendingIncomeWarning =
    Boolean(editingProject) && isClosedProject(editForm.status) && (editingProject?.pendingIncomeCount ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Proyectos"
        title="Desarrollo fijo y mantenimiento recurrente, separados de verdad"
        description="Cada proyecto distingue el cierre del build inicial del fee mensual operativo. El dashboard sigue viendo todo como caja, pero la gestión ya no mezcla conceptos."
        demoMode={demoMode}
      />

      <div className="space-y-6">
        <Card>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo proyecto</h2>
              <p className="mt-1 text-sm text-ink/55">El costo de desarrollo y el fee mensual viven en carriles distintos. Eso evita medir suscripción con lógica de presupuesto fijo.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Cliente</label>
              <Select value={form.clientId} onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre del proyecto</label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Estado</label>
                <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {formatProjectStatus(status)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="rounded-[1.4rem] border border-black/10 bg-[linear-gradient(135deg,rgba(240,249,255,0.85),rgba(255,255,255,0.92))] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cobalt">Estructura financiera</div>
                <p className="mt-2 text-sm text-ink/62">El desarrollo define el saldo pendiente. El mantenimiento mensual no lo toca.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-cobalt/15 bg-cobalt/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt">Desarrollo fijo</div>
                <Input
                  className="mt-3"
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.devBudgetUsd}
                  onChange={(event) => setForm((prev) => ({ ...prev, devBudgetUsd: event.target.value }))}
                />
              </div>
              <div className="rounded-[1.35rem] border border-emerald-900/15 bg-emerald-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-950">Fee mensual</div>
                <Input
                  className="mt-3"
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.monthlyFeeUsd}
                  onChange={(event) => setForm((prev) => ({ ...prev, monthlyFeeUsd: event.target.value }))}
                />
              </div>
              <div className="rounded-[1.35rem] border border-amber-950/15 bg-amber-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-950">Fin mantenimiento</div>
                <Input
                  className="mt-3"
                  type="date"
                  value={form.monthlyFeeEndDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, monthlyFeeEndDate: event.target.value }))}
                />
                <p className="mt-3 text-xs text-ink/55">Vacío = horizonte abierto de 12 meses.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
              <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>

            {error ? <p className="text-sm text-brick">{error}</p> : null}

            <Button type="submit" disabled={isPending || demoMode || !form.clientId || !form.name.trim()}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear proyecto"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Portafolio actual</h2>
              <p className="mt-1 text-sm text-ink/55">La tabla expone el carril de desarrollo y la suscripción mensual sin colapsarlos en una sola cifra.</p>
            </div>
            <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2">
              <Select value={filters.clientId} onChange={(event) => setFilters((prev) => ({ ...prev, clientId: event.target.value }))}>
                <option value="">Todos los clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
              <Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">Todos los estados</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatProjectStatus(status)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {visibleProjects.length === 0 ? (
            <EmptyState title="Sin proyectos" description="Ajustá filtros o cargá un proyecto para empezar a medir desarrollo y fee mensual por separado." />
          ) : (
            <DataTable headers={["Proyecto", "Desarrollo", "Fee mensual", "Cobrado real", "Próximo cobro", "Acciones"]}>
              {visibleProjects.map((project) => {
                const ratio = developmentRatio(project);

                return (
                  <tr key={project.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{project.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">{project.clientName}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={statusTone(project.status)}>{formatProjectStatus(project.status)}</Badge>
                        {isClosedProject(project.status) && project.pendingIncomeCount > 0 ? (
                          <Badge tone="warning">{project.pendingIncomeCount} pendientes</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {project.devBudgetUsd !== null ? (
                        <div className="min-w-[13rem] space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-ink/45">
                            <span>{formatUsd(project.developmentCollectedUsd)}</span>
                            <span>{formatUsd(project.devBudgetUsd)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-black/8">
                            <div className="h-full rounded-full bg-cobalt" style={{ width: `${ratio ?? 0}%` }} />
                          </div>
                          <div className="text-xs text-ink/60">
                            Saldo dev: <span className="font-semibold text-ink">{formatUsd(project.developmentPendingUsd)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-ink/45">Sin presupuesto de desarrollo</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {project.monthlyFeeUsd !== null ? (
                        <div className="space-y-1">
                          <div className="font-display text-2xl text-emerald-950">{formatUsd(project.monthlyFeeUsd)}</div>
                          <div className="text-xs text-ink/55">
                            Cobrado por mantenimiento: {formatUsd(project.maintenanceCollectedUsd)}
                          </div>
                          <div className="text-xs text-ink/55">
                            {project.monthlyFeeEndDate ? `Vence ${formatShortDate(project.monthlyFeeEndDate)}` : "Sin fecha de cierre"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-ink/45">Sin fee configurado</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-display text-2xl text-ink">{formatUsd(project.totalCollectedUsd)}</div>
                      <div className="text-xs text-ink/55">Desarrollo + mantenimiento</div>
                    </td>
                    <td className="px-4 py-3">{formatShortDate(project.nextPaymentDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={`Editar ${project.name}`}
                          className={actionButtonClass()}
                          onClick={() => openEditModal(project)}
                          title="Editar proyecto"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Eliminar ${project.name}`}
                          className={actionButtonClass("danger")}
                          onClick={() => openDeleteModal(project)}
                          title="Eliminar proyecto"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/8" href={`/projects/${project.id}`}>
                          Abrir
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      </div>

      <EditEntityModal
        open={Boolean(editingProject)}
        title="Editar proyecto"
        description="Ajustá el nombre, el presupuesto de desarrollo y el fee mensual sin mezclar sus efectos sobre el saldo pendiente."
        submitLabel="Guardar proyecto"
        isPending={isPending}
        disabled={demoMode}
        error={editError}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
      >
        <div className="space-y-4">
          <div className="rounded-[1.2rem] border border-black/10 bg-black/[0.02] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Cliente</div>
            <div className="mt-2 text-sm font-semibold text-ink">{editingProject?.clientName ?? "—"}</div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre del proyecto</label>
            <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Estado</label>
              <Select value={editForm.status} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatProjectStatus(status)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Presupuesto de desarrollo</label>
              <Input
                min="0"
                step="0.01"
                type="number"
                value={editForm.devBudgetUsd}
                onChange={(event) => setEditForm((prev) => ({ ...prev, devBudgetUsd: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fee mensual</label>
              <Input
                min="0"
                step="0.01"
                type="number"
                value={editForm.monthlyFeeUsd}
                onChange={(event) => setEditForm((prev) => ({ ...prev, monthlyFeeUsd: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Fecha de fin de mantenimiento</label>
              <Input
                type="date"
                value={editForm.monthlyFeeEndDate}
                onChange={(event) => setEditForm((prev) => ({ ...prev, monthlyFeeEndDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
            <Textarea value={editForm.notes} onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>

          {showPendingIncomeWarning ? (
            <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 p-4 text-sm text-brick">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  Este proyecto tiene <span className="font-semibold">{editingProject?.pendingIncomeCount}</span> ingreso(s) en estado
                  `PENDING`. Si lo pasás a {formatProjectStatus(editForm.status).toLowerCase()}, revisalos antes de cerrar el frente operativo.
                </div>
              </div>
            </div>
          ) : null}

          {demoMode ? <p className="text-sm text-ink/55">La edición persistente requiere `DATABASE_URL`.</p> : null}
        </div>
      </EditEntityModal>

      <ConfirmActionModal
        open={Boolean(deletingProject)}
        title="Eliminar proyecto"
        description="La baja física sigue protegida. Si hay ingresos, gastos o cobros programados asociados, el backend va a impedirla y sugerir `CANCELLED`."
        confirmLabel="Eliminar proyecto"
        isPending={isPending}
        disabled={demoMode}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
      >
        {deletingProject ? (
          <div className="space-y-2 text-sm text-ink/70">
            <p>
              Proyecto: <span className="font-semibold text-ink">{deletingProject.name}</span>.
            </p>
            <p>
              Desarrollo pendiente: <span className="font-semibold text-ink">{formatUsd(deletingProject.developmentPendingUsd)}</span>.
            </p>
            <p>
              Fee mensual actual: <span className="font-semibold text-ink">{formatUsd(deletingProject.monthlyFeeUsd)}</span>.
            </p>
            {deletingProject.pendingIncomeCount > 0 ? (
              <p className="text-brick">
                Tiene {deletingProject.pendingIncomeCount} ingreso(s) `PENDING`. Conviene resolverlos antes de intentar la baja definitiva.
              </p>
            ) : (
              <p className="text-ink/65">Si no existen movimientos asociados, la eliminación debería completarse.</p>
            )}
            {demoMode ? <p>La eliminación persistente requiere `DATABASE_URL`.</p> : null}
          </div>
        ) : null}
      </ConfirmActionModal>
    </div>
  );
}
