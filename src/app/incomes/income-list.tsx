"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { IncomeFormModal } from "./income-form-modal";
import { PayIncomeModal } from "./pay-income-modal";
import { InstallmentModal } from "./installment-modal";
import { saveIncome, removeIncome, payIncome, createInstallments } from "./actions";
import { formatUsd, formatArs, formatDate, formatDateShort, formatIncomeStatus, formatIncomeType } from "@/lib/utils";

type Income = { id: string; type: string; concept: string; notes: string | null; status: string;
  amountUsd: any; amountArs: any; exchangeRate: any; dueDate: string | Date | null; effectiveDate: string | Date | null;
  clientId: string | null; projectId: string | null; client: { id: string; name: string } | null;
  project: { id: string; name: string; clientId: string } | null; };

function fmt(v: any) { return typeof v === "object" && v != null && "toString" in v ? Number(v.toString()) : Number(v ?? 0); }

export function IncomeList({ initialIncomes, projects, clients }: { initialIncomes: Income[]; projects: { id: string; name: string; clientId?: string }[]; clients: { id: string; name: string }[] }) {
  const [incomes] = useState<Income[]>(initialIncomes);
  const [filter, setFilter] = useState("all"); const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Income | null>(null);
  const [payTarget, setPayTarget] = useState<Income | null>(null); const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [showInst, setShowInst] = useState(false);
  const [_, startTransition] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();

  const didOpen = useRef(false);
  useEffect(() => { if (!didOpen.current && sp.get("new") === "1") { didOpen.current = true; setShowForm(true); router.replace("/incomes"); } }, [sp, router]);

  // Sync filters from query params (from dashboard links)
  const didSync = useRef(false);
  useEffect(() => {
    if (didSync.current) return;
    const s = sp.get("status"); if (s === "PAID" || s === "PENDING") { setFilter(s); didSync.current = true; return; }
    if (s === "OVERDUE") { setFilter("OVERDUE"); didSync.current = true; }
  }, [sp]);

  const reload = () => { setTimeout(() => window.location.reload(), 500); };
  const mkFd = (data: Record<string, unknown>, id?: string) => {
    const fd = new FormData(); if (id) fd.set("id", id);
    Object.entries(data).forEach(([k,v]) => { if (v != null && v !== "") fd.set(k, String(v)); });
    return fd;
  };

  const handleSave = async (data: Record<string, unknown>) => { startTransition(() => { saveIncome(null, mkFd(data, editing?.id)); }); setShowForm(false); setEditing(null); reload(); };
  const handlePay = async (data: Record<string, unknown>) => { if (!payTarget) return; const fd = mkFd({ effectiveDate: data.effectiveDate, amountUsd: data.amountUsd, amountArs: data.amountArs, exchangeRate: data.exchangeRate }, payTarget.id); startTransition(() => { payIncome(null, fd); }); setPayTarget(null); reload(); };
  const handleDelete = () => { if (!deleteTarget) return; startTransition(() => { removeIncome(null, mkFd({}, deleteTarget.id)); }); setDeleteTarget(null); reload(); };
  const handleInstallments = async (data: Record<string, unknown>) => { startTransition(() => { createInstallments(null, mkFd(data)); }); setShowInst(false); reload(); };

  const filtered = incomes.filter(inc => {
    if (filter === "PENDING" && inc.status !== "PENDING") return false;
    if (filter === "PAID" && inc.status !== "PAID") return false;
    if (filter === "OVERDUE") { if (inc.status !== "PENDING") return false; const t = new Date(); const d = inc.dueDate ? new Date(inc.dueDate) : null; return d && d < t; }
    if (typeFilter && inc.type !== typeFilter) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((s, inc) => s + fmt(inc.amountUsd), 0);

  const statusLabel = (s: string, d: any) => formatIncomeStatus(s, d);
  const statusTone = (s: string, d: any): "success" | "danger" | "warning" | "neutral" => { const l = statusLabel(s, d); if (l === "Cobrado") return "success"; if (l === "Vencido") return "danger"; if (l === "Pendiente") return "warning"; return "neutral"; };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-28 text-xs">
            <option value="all">Todos</option><option value="PAID">Cobrados</option><option value="PENDING">Pendientes</option><option value="OVERDUE">Vencidos</option>
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36 text-xs">
            <option value="">Todos los tipos</option><option value="DEVELOPMENT">Desarrollo</option><option value="MAINTENANCE">Mantenimiento</option><option value="OTHER">Otro</option>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" className="text-xs" onClick={() => setShowInst(true)}>Cuotas</Button>
          <Button className="text-xs" onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo ingreso</Button>
        </div>
      </div>

      {/* Filtered total */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
        <span className="text-gray-500">Total filtrado · <span className="font-medium">{filtered.length} movimientos</span></span>
        <span className="font-bold tabular-nums text-gray-900">{formatUsd(filteredTotal)}</span>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block">
        <DataTable headers={["Concepto","Cliente","Proyecto","Tipo","Estado","Fecha","USD","ARS","Acciones"]}>
          {filtered.map(inc => (
            <tr key={inc.id}>
              <td className="px-4 py-3 text-sm">{inc.concept}</td>
              <td className="px-4 py-3 text-sm">{inc.client?.name ?? "—"}</td>
              <td className="px-4 py-3 text-sm">{inc.project?.name ?? "—"}</td>
              <td className="px-4 py-3 text-sm">{formatIncomeType(inc.type)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(inc.status, inc.dueDate)}>{statusLabel(inc.status, inc.dueDate)}</Badge></td>
              <td className="px-4 py-3 text-sm tabular-nums">{inc.status === "PAID" ? formatDate(inc.effectiveDate) : formatDate(inc.dueDate)}</td>
              <td className="px-4 py-3 text-sm text-right tabular-nums">{formatUsd(fmt(inc.amountUsd))}</td>
              <td className="px-4 py-3 text-sm text-right tabular-nums">{inc.amountArs ? formatArs(fmt(inc.amountArs)) : "—"}</td>
              <td className="px-4 py-3 space-x-1">
                {inc.status === "PENDING" && <Button variant="secondary" className="text-xs" onClick={() => setPayTarget(inc)}>Cobrar</Button>}
                <Button variant="secondary" className="text-xs" onClick={() => { setEditing(inc); setShowForm(true); }}>Editar</Button>
                <Button variant="secondary" className="text-xs text-brick" onClick={() => { setDeleteTarget(inc); setDelError(null); }}>Elim.</Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* MOBILE CARDS */}
      <div className="space-y-2 md:hidden">
        {filtered.map(inc => (
          <div key={inc.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{inc.concept}</span>
              <Badge tone={statusTone(inc.status, inc.dueDate)}>{statusLabel(inc.status, inc.dueDate)}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{formatIncomeType(inc.type)}</span>
              <span className="font-semibold tabular-nums">{formatUsd(fmt(inc.amountUsd))}</span>
            </div>
            <div className="text-xs text-gray-400 flex justify-between">
              <span>{inc.client?.name ?? "—"}{inc.project ? ` · ${inc.project.name}` : ""}</span>
              <span>{inc.status === "PAID" ? formatDate(inc.effectiveDate) : formatDate(inc.dueDate)}</span>
            </div>
            {inc.amountArs && <div className="text-xs text-gray-500 text-right">{formatArs(fmt(inc.amountArs))}</div>}
            <div className="flex gap-1 pt-1">
              {inc.status === "PENDING" && <Button variant="secondary" className="text-xs flex-1" onClick={() => setPayTarget(inc)}>Cobrar</Button>}
              <Button variant="secondary" className="text-xs flex-1" onClick={() => { setEditing(inc); setShowForm(true); }}>Editar</Button>
              <Button variant="secondary" className="text-xs flex-1 text-brick" onClick={() => { setDeleteTarget(inc); setDelError(null); }}>Elim.</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Sin ingresos.</p>}
      </div>

      <IncomeFormModal open={showForm} title={editing ? "Editar ingreso" : "Nuevo ingreso"} projects={projects} clients={clients}
        initial={editing ? { id: editing.id, type: editing.type, concept: editing.concept, notes: editing.notes, status: editing.status, projectId: editing.projectId, clientId: editing.clientId, amountUsd: editing.amountUsd, amountArs: editing.amountArs, exchangeRate: editing.exchangeRate, dueDate: editing.dueDate ? (editing.dueDate instanceof Date ? editing.dueDate.toISOString().slice(0,10) : String(editing.dueDate).slice(0,10)) : null, effectiveDate: editing.effectiveDate ? (editing.effectiveDate instanceof Date ? editing.effectiveDate.toISOString().slice(0,10) : String(editing.effectiveDate).slice(0,10)) : null, client: editing.client, project: editing.project } : undefined}
        onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} />

      <PayIncomeModal open={!!payTarget} income={payTarget} onClose={() => setPayTarget(null)} onConfirm={handlePay} />
      <InstallmentModal open={showInst} onClose={() => setShowInst(false)} onSave={handleInstallments} />

      <ConfirmActionModal open={!!deleteTarget} title={deleteTarget?.status === "PAID" ? "Eliminar ingreso cobrado" : "Eliminar ingreso"}
        description={deleteTarget?.status === "PAID" ? "Este ingreso ya esta cobrado. ¿Confirmas que queres eliminarlo?" : `¿Eliminar "${deleteTarget?.concept}"?`}
        confirmLabel="Eliminar" isPending={false} error={delError} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </div>
  );
}
