"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { ProjectFormModal } from "./project-form-modal";
import { saveProject, removeProject } from "./actions";

type Project = {
  id: string;
  name: string;
  isActive: boolean;
  startDate: string | Date | null;
  endDate: string | Date | null;
  oneTimeCurrency: string | null;
  oneTimeAmountUsd: { toString(): string } | string | number | null;
  monthlyRecurringCurrency: string | null;
  monthlyRecurringAmountUsd: { toString(): string } | string | number | null;
  client: { id: string; name: string };
  _count: { incomes: number; expenses: number };
};

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

function fmtAmount(currency: string | null, usd: { toString(): string } | string | number | null) {
  if (!currency || usd == null) return "—";
  const n = typeof usd === "object" && "toString" in usd ? Number(usd.toString()) : Number(usd);
  if (currency === "USD") return `USD ${n.toFixed(2)}`;
  return `ARS → USD ${n.toFixed(2)}`;
}

function toISODate(d: string | Date | null): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

export function ProjectList({ initialProjects, clients }: { initialProjects: Project[]; clients: { id: string; name: string }[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();


const reload = () => { setTimeout(() => window.location.reload(), 500); };

  const handleSave = async (data: Record<string, unknown>) => {
    const fd = new FormData();
    if (editProject) fd.set("id", editProject.id);
    fd.set("clientId", data.clientId as string);
    fd.set("name", data.name as string);
    fd.set("isActive", data.isActive ? "true" : "false");
    if (data.startDate) fd.set("startDate", data.startDate as string);
    if (data.endDate) fd.set("endDate", data.endDate as string);
    if (data.notes) fd.set("notes", data.notes as string);
    if (data.oneTimeOriginalAmount != null) {
      fd.set("oneTimeOriginalAmount", String(data.oneTimeOriginalAmount));
      fd.set("oneTimeCurrency", (data.oneTimeCurrency as string) || "USD");
      if (data.oneTimeExchangeRate != null) fd.set("oneTimeExchangeRate", String(data.oneTimeExchangeRate));
    }
    if (data.monthlyRecurringOriginalAmount != null) {
      fd.set("monthlyRecurringOriginalAmount", String(data.monthlyRecurringOriginalAmount));
      fd.set("monthlyRecurringCurrency", (data.monthlyRecurringCurrency as string) || "USD");
      if (data.monthlyRecurringExchangeRate != null) fd.set("monthlyRecurringExchangeRate", String(data.monthlyRecurringExchangeRate));
    }
    startTransition(() => { saveProject(null, fd); });
    setShowForm(false);
    setEditProject(null);
    reload();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDelError(null);
    const fd = new FormData();
    fd.set("id", deleteTarget.id);
    startTransition(() => { removeProject(null, fd); });
    setDeleteTarget(null);
    reload();
  };

  const handleToggle = (p: Project) => {
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("clientId", p.client.id);
    fd.set("name", p.name);
    fd.set("isActive", p.isActive ? "true" : "false");
    startTransition(() => { saveProject(null, fd); });
    reload();
  };

  const filtered = projects.filter((p) => {
    if (filter === "active") return p.isActive;
    if (filter === "inactive") return !p.isActive;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-40">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
        <Button onClick={() => { setEditProject(null); setShowForm(true); }}>Nuevo proyecto</Button>
      </div>

      <DataTable headers={["Proyecto", "Cliente", "Estado", "Inicio", "Fin", "Importe acordado", "Importe mensual", "Acciones"]}>
        {filtered.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3"><Link href={`/projects/${p.id}`} className="text-cobalt underline">{p.name}</Link></td>
            <td className="px-4 py-3">{p.client.name}</td>
            <td className="px-4 py-3"><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Activo" : "Inactivo"}</Badge></td>
            <td className="px-4 py-3">{fmtDate(p.startDate)}</td>
            <td className="px-4 py-3">{fmtDate(p.endDate)}</td>
            <td className="px-4 py-3">{fmtAmount(p.oneTimeCurrency, p.oneTimeAmountUsd)}</td>
            <td className="px-4 py-3">{fmtAmount(p.monthlyRecurringCurrency, p.monthlyRecurringAmountUsd)}</td>
            <td className="px-4 py-3 space-x-1">
              <Button variant="secondary" onClick={() => { setEditProject(p); setShowForm(true); }}>Editar</Button>
              <Button variant="secondary" onClick={() => handleToggle(p)}>{p.isActive ? "Inactivar" : "Activar"}</Button>
              <Button variant="secondary" className="text-brick" onClick={() => { setDeleteTarget(p); setDelError(null); }}>Eliminar</Button>
            </td>
          </tr>
        ))}
      </DataTable>

      <ProjectFormModal
        open={showForm}
        title={editProject ? "Editar proyecto" : "Nuevo proyecto"}
        initial={editProject ? {
          id: editProject.id,
          clientId: editProject.client.id,
          name: editProject.name,
          isActive: editProject.isActive,
          startDate: toISODate(editProject.startDate),
          endDate: toISODate(editProject.endDate),
          oneTimeAmountUsd: editProject.oneTimeAmountUsd ? String(editProject.oneTimeAmountUsd) : null,
          oneTimeCurrency: editProject.oneTimeCurrency,
          monthlyRecurringAmountUsd: editProject.monthlyRecurringAmountUsd ? String(editProject.monthlyRecurringAmountUsd) : null,
          monthlyRecurringCurrency: editProject.monthlyRecurringCurrency,
          client: editProject.client,
          _count: editProject._count,
        } : undefined}
        onClose={() => { setShowForm(false); setEditProject(null); }}
        onSave={handleSave}
        clients={clients}
      />

      <ConfirmActionModal
        open={!!deleteTarget}
        title="Eliminar proyecto"
        description={`¿Eliminar "${deleteTarget?.name}"? Si tiene movimientos, mejor marcalo como inactivo.`}
        confirmLabel="Eliminar"
        isPending={isPending}
        error={delError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
