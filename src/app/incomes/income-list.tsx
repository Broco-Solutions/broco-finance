"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { IncomeFormModal } from "./income-form-modal";
import { PayIncomeModal } from "./pay-income-modal";
import { InstallmentModal } from "./installment-modal";
import { saveIncome, removeIncome, payIncome, createInstallments } from "./actions";

type Income = {
  id: string;
  type: string;
  concept: string;
  notes: string | null;
  status: string;
  amountUsd: { toString(): string } | number | string;
  amountArs: { toString(): string } | number | string | null;
  exchangeRate: { toString(): string } | number | string | null;
  dueDate: string | Date | null;
  effectiveDate: string | Date | null;
  clientId: string | null;
  projectId: string | null;
  client: { id: string; name: string } | null;
  project: { id: string; name: string; clientId: string } | null;
};

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

function fmtUsd(v: { toString(): string } | number | string | null) {
  if (v == null) return "—";
  return Number(typeof v === "object" ? v.toString() : v).toFixed(2);
}

function fmtArs(v: { toString(): string } | number | string | null) {
  if (v == null) return "—";
  return Number(typeof v === "object" ? v.toString() : v).toFixed(2);
}

function statusLabel(s: string, dueDate: string | Date | null) {
  if (s === "PAID") return "Cobrado";
  if (s === "PENDING") {
    const today = new Date();
    const d = dueDate ? new Date(dueDate) : null;
    return d && d < today ? "Vencido" : "Pendiente";
  }
  return s;
}

function statusTone(s: string, dueDate: string | Date | null) {
  const label = statusLabel(s, dueDate);
  if (label === "Cobrado") return "success";
  if (label === "Vencido") return "danger";
  return "warning";
}

function typeLabel(t: string) {
  if (t === "DEVELOPMENT") return "Desarrollo";
  if (t === "MAINTENANCE") return "Mantenimiento";
  return "Otro";
}

export function IncomeList({ initialIncomes, projects, clients }: {
  initialIncomes: Income[];
  projects: { id: string; name: string; clientId?: string }[];
  clients: { id: string; name: string }[];
}) {
  const [incomes, setIncomes] = useState<Income[]>(initialIncomes);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [payTarget, setPayTarget] = useState<Income | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [showInst, setShowInst] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  const reload = () => { setTimeout(() => window.location.reload(), 500); };

  const handleSave = async (data: Record<string, unknown>) => {
    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("type", data.type as string);
    fd.set("concept", data.concept as string);
    fd.set("status", data.status as string);
    if (data.projectId) fd.set("projectId", data.projectId as string);
    if (data.clientId) fd.set("clientId", data.clientId as string);
    if (data.notes) fd.set("notes", data.notes as string);
    if (data.amountUsd != null && data.amountUsd !== "") fd.set("amountUsd", String(data.amountUsd));
    if (data.amountArs != null && data.amountArs !== "") fd.set("amountArs", String(data.amountArs));
    if (data.exchangeRate != null && data.exchangeRate !== "") fd.set("exchangeRate", String(data.exchangeRate));
    if (data.dueDate) fd.set("dueDate", data.dueDate as string);
    if (data.effectiveDate) fd.set("effectiveDate", data.effectiveDate as string);
    startTransition(() => { saveIncome(null, fd); });
    setShowForm(false);
    setEditing(null);
    reload();
  };

  const handlePay = async (data: Record<string, unknown>) => {
    if (!payTarget) return;
    const fd = new FormData();
    fd.set("id", payTarget.id);
    fd.set("effectiveDate", data.effectiveDate as string);
    if (data.amountUsd != null && data.amountUsd !== "") fd.set("amountUsd", String(data.amountUsd));
    if (data.amountArs != null && data.amountArs !== "") fd.set("amountArs", String(data.amountArs));
    if (data.exchangeRate != null && data.exchangeRate !== "") fd.set("exchangeRate", String(data.exchangeRate));
    startTransition(() => { payIncome(null, fd); });
    setPayTarget(null);
    reload();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.set("id", deleteTarget.id);
    startTransition(() => { removeIncome(null, fd); });
    setDeleteTarget(null);
    reload();
  };

  const handleInstallments = async (data: Record<string, unknown>) => {
    const fd = new FormData();
    fd.set("projectId", data.projectId as string);
    fd.set("type", data.type as string);
    fd.set("concept", data.concept as string);
    fd.set("count", String(data.count));
    fd.set("firstDueDate", data.firstDueDate as string);
    if (data.amountUsd != null && data.amountUsd !== "") fd.set("amountUsd", String(data.amountUsd));
    if (data.amountArs != null && data.amountArs !== "") fd.set("amountArs", String(data.amountArs));
    if (data.exchangeRate != null && data.exchangeRate !== "") fd.set("exchangeRate", String(data.exchangeRate));
    if (data.notes) fd.set("notes", data.notes as string);
    startTransition(() => { createInstallments(null, fd); });
    setShowInst(false);
    reload();
  };

  const filtered = incomes.filter((inc) => {
    if (filter === "PENDING" && inc.status !== "PENDING") return false;
    if (filter === "PAID" && inc.status !== "PAID") return false;
    if (filter === "OVERDUE") {
      if (inc.status !== "PENDING") return false;
      const today = new Date();
      const d = inc.dueDate ? new Date(inc.dueDate) : null;
      return d && d < today;
    }
    if (typeFilter && inc.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-36">
            <option value="all">Todos</option>
            <option value="PAID">Cobrados</option>
            <option value="PENDING">Pendientes</option>
            <option value="OVERDUE">Vencidos</option>
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
            <option value="">Todos los tipos</option>
            <option value="DEVELOPMENT">Desarrollo</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="OTHER">Otro</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowInst(true)}>Generar cuotas</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo ingreso</Button>
        </div>
      </div>

      <DataTable headers={["Concepto", "Cliente", "Proyecto", "Tipo", "Estado", "Fecha", "USD", "ARS", "Acciones"]}>
        {filtered.map((inc) => (
          <tr key={inc.id}>
            <td className="px-4 py-3">{inc.concept}</td>
            <td className="px-4 py-3">{inc.client?.name ?? "—"}</td>
            <td className="px-4 py-3">{inc.project?.name ?? "—"}</td>
            <td className="px-4 py-3">{typeLabel(inc.type)}</td>
            <td className="px-4 py-3">
              <Badge tone={statusTone(inc.status, inc.dueDate) as "success"|"danger"|"warning"}>
                {statusLabel(inc.status, inc.dueDate)}
              </Badge>
            </td>
            <td className="px-4 py-3">
              {inc.status === "PAID" ? fmtDate(inc.effectiveDate) : fmtDate(inc.dueDate)}
            </td>
            <td className="px-4 py-3">{fmtUsd(inc.amountUsd)}</td>
            <td className="px-4 py-3">{fmtArs(inc.amountArs)}</td>
            <td className="px-4 py-3 space-x-1">
              {inc.status === "PENDING" && (
                <Button variant="secondary" onClick={() => setPayTarget(inc)}>Cobrar</Button>
              )}
              <Button variant="secondary" onClick={() => { setEditing(inc); setShowForm(true); }}>Editar</Button>
              <Button variant="secondary" className="text-brick" onClick={() => { setDeleteTarget(inc); setDelError(null); }}>Eliminar</Button>
            </td>
          </tr>
        ))}
      </DataTable>

      <IncomeFormModal
        open={showForm}
        title={editing ? "Editar ingreso" : "Nuevo ingreso"}
        projects={projects}
        clients={clients}
        initial={editing ? {
          id: editing.id,
          type: editing.type,
          concept: editing.concept,
          notes: editing.notes,
          status: editing.status,
          projectId: editing.projectId,
          clientId: editing.clientId,
          amountUsd: editing.amountUsd,
          amountArs: editing.amountArs,
          exchangeRate: editing.exchangeRate,
          dueDate: editing.dueDate ? fmtDate(editing.dueDate) : null,
          effectiveDate: editing.effectiveDate ? fmtDate(editing.effectiveDate) : null,
          client: editing.client,
          project: editing.project,
        } : undefined}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
      />

      <PayIncomeModal
        open={!!payTarget}
        income={payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={handlePay}
      />

      <InstallmentModal
        open={showInst}
        onClose={() => setShowInst(false)}
        onSave={handleInstallments}
      />

      <ConfirmActionModal
        open={!!deleteTarget}
        title={deleteTarget?.status === "PAID" ? "Eliminar ingreso cobrado" : "Eliminar ingreso"}
        description={deleteTarget?.status === "PAID"
          ? "Este ingreso ya esta cobrado. ¿Confirmas que queres eliminarlo?"
          : `¿Eliminar "${deleteTarget?.concept}"?`}
        confirmLabel="Eliminar"
        isPending={false}
        error={delError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
