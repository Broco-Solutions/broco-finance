"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord, ProjectRecord, ProjectStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
          <DataTable headers={["Proyecto", "Cliente", "Cobrado", "Presupuesto", "Próximo cobro", "Detalle"]}>
            {visibleProjects.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3 font-semibold text-ink">{project.name}</td>
                <td className="px-4 py-3">{project.clientName}</td>
                <td className="px-4 py-3">{formatUsd(project.totalCollectedUsd)}</td>
                <td className="px-4 py-3">{project.totalBudgetUsd ? formatUsd(project.totalBudgetUsd) : "—"}</td>
                <td className="px-4 py-3">{formatShortDate(project.nextPaymentDate)}</td>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-cobalt" href={`/projects/${project.id}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
