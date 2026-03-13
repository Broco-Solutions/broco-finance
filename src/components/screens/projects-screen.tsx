"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord, ProjectRecord, ProjectStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EditEntityModal } from "@/components/ui/edit-entity-modal";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statuses: ProjectStatus[] = ["active", "finished", "cancelled"];

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
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? "",
    name: "",
    status: "active",
    totalBudgetUsd: "",
    notes: "",
  });

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
          body: JSON.stringify({
            clientId: form.clientId,
            name: form.name,
            status: form.status,
            totalBudgetUsd: form.totalBudgetUsd ? Number(form.totalBudgetUsd) : null,
            notes: form.notes || null,
          }),
        });
        setForm((prev) => ({ ...prev, name: "", totalBudgetUsd: "", notes: "" }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el proyecto.");
      }
    });
  };

  const openEditModal = (project: ProjectRecord) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingProject(null);
    setEditName("");
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
          body: JSON.stringify({
            clientId: editingProject.clientId,
            name: editName,
            status: editingProject.status,
            totalBudgetUsd: editingProject.totalBudgetUsd,
            notes: editingProject.notes ?? null,
          }),
        });
        closeEditModal();
        router.refresh();
      } catch (submitError) {
        setEditError(submitError instanceof Error ? submitError.message : "No se pudo actualizar el proyecto.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Proyectos"
        title="Contenedores financieros por cliente"
        description="Cada proyecto agrupa ingresos, gastos, contratos recurrentes y pagos esperados. El detalle es la unidad real de operación."
        demoMode={demoMode}
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo proyecto</h2>
              <p className="mt-1 text-sm text-ink/55">Alta mínima con presupuesto opcional y vínculo inmediato al cliente.</p>
            </div>
            <Select value={form.clientId} onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Nombre del proyecto" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min="0"
              placeholder="Presupuesto USD"
              value={form.totalBudgetUsd}
              onChange={(event) => setForm((prev) => ({ ...prev, totalBudgetUsd: event.target.value }))}
            />
            <Textarea placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear proyecto"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Portafolio actual</h2>
              <p className="mt-1 text-sm text-ink/55">Filtrá por cliente o estado para seguir el pipeline financiero.</p>
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
                    {status}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DataTable headers={["Proyecto", "Cliente", "Cobrado", "Presupuesto", "Próximo cobro", "Acciones"]}>
            {visibleProjects.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3 font-semibold text-ink">{project.name}</td>
                <td className="px-4 py-3">{project.clientName}</td>
                <td className="px-4 py-3">{formatUsd(project.totalCollectedUsd)}</td>
                <td className="px-4 py-3">{project.totalBudgetUsd ? formatUsd(project.totalBudgetUsd) : "—"}</td>
                <td className="px-4 py-3">{formatShortDate(project.nextPaymentDate)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-label={`Editar ${project.name}`}
                      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-black/5"
                      onClick={() => openEditModal(project)}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <Link className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/8" href={`/projects/${project.id}`}>
                      Abrir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <EditEntityModal
        open={Boolean(editingProject)}
        title="Editar proyecto"
        description="Esta edición rápida actualiza el nombre visible del proyecto y conserva cliente, estado, presupuesto y notas."
        submitLabel="Guardar proyecto"
        isPending={isPending}
        disabled={demoMode}
        error={editError}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
      >
        <div className="space-y-4">
          <div className="grid gap-3 rounded-[1.2rem] border border-black/10 bg-black/[0.02] p-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Cliente</div>
              <div className="mt-2 text-sm font-semibold text-ink">{editingProject?.clientName ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Estado</div>
              <div className="mt-2 text-sm font-semibold uppercase text-ink">{editingProject?.status ?? "—"}</div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre del proyecto</label>
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
          </div>
          {demoMode ? <p className="text-sm text-ink/55">La edición persistente requiere `DATABASE_URL`.</p> : null}
        </div>
      </EditEntityModal>
    </div>
  );
}
