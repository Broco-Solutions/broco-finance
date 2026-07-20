"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { IncomeFormModal } from "./income-form-modal";
import { PayIncomeModal } from "./pay-income-modal";
import { saveIncome, removeIncome, payIncome, createIncomeBatch } from "./actions";
import { formatUsd, formatArs, formatDate, formatDateShort, formatIncomeStatus, formatIncomeType } from "@/lib/utils";

type Income = { id: string; type: string; concept: string; notes: string | null; status: string;
  amountUsd: any; amountArs: any; exchangeRate: any; dueDate: string | Date | null; effectiveDate: string | Date | null;
  clientId: string | null; projectId: string | null; client: { id: string; name: string } | null;
  project: { id: string; name: string; clientId: string } | null; };

function fmt(v: any) { return typeof v === "object" && v != null && "toString" in v ? Number(v.toString()) : Number(v ?? 0); }

export function IncomeList({ initialIncomes, projects, clients }: { initialIncomes: Income[]; projects: { id: string; name: string; clientId?: string }[]; clients: { id: string; name: string }[] }) {
  const [incomes] = useState<Income[]>(initialIncomes);
  const [filter, setFilter] = useState("PAID"); const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState("");
  const [fClient, setFClient] = useState(""); const [fProject, setFProject] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Income | null>(null);
  const [payTarget, setPayTarget] = useState<Income | null>(null); const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();

  const didOpen = useRef(false);
  useEffect(() => { if (!didOpen.current && sp.get("new") === "1") { didOpen.current = true; setShowForm(true); router.replace("/incomes"); } }, [sp, router]);

  // Sync filters from query params
  const didSync = useRef(false);
  useEffect(() => {
    if (didSync.current) return;
    const s = sp.get("status"); if (s === "PAID" || s === "PENDING") setFilter(s); else if (s === "OVERDUE") setFilter("OVERDUE");
    const f = sp.get("from"), t = sp.get("to");
    if (f && t) { setDateFrom(f); setDateTo(t); }
    didSync.current = true;
  }, [sp]);

  const clearRange = () => { setDateFrom(""); setDateTo(""); router.replace("/incomes"); };
  const clearFilters = () => { setFilter("PAID"); setTypeFilter(""); setFClient(""); setFProject(""); clearRange(); };

  const reload = () => { setTimeout(() => window.location.reload(), 500); };
  const mkFd = (data: Record<string, unknown>, id?: string) => {
    const fd = new FormData(); if (id) fd.set("id", id);
    Object.entries(data).forEach(([k,v]) => { if (v != null && v !== "") fd.set(k, String(v)); });
    return fd;
  };

  const handleSave = async (data: Record<string, unknown>) => {
    const batch = data.batch as Array<Record<string, unknown>> | undefined;
    if (batch) {
      const entries = batch.map(r => ({
        type: data.type as string, projectId: (data.projectId as string) || null, clientId: (data.clientId as string) || null,
        concept: data.concept as string, notes: (data.notes as string) || null, status: r.status as string,
        amountUsd: (r.amountUsd as string) ? Number(r.amountUsd) : undefined,
        amountArs: (r.amountArs as string) ? Number(r.amountArs) : undefined,
        exchangeRate: (r.exchangeRate as string) ? Number(r.exchangeRate) : undefined,
        dueDate: r.status === "PENDING" ? (r.date as string) : null,
        effectiveDate: r.status === "PAID" ? (r.date as string) : null,
      }));
      const result = await createIncomeBatch(entries);
      if (!result.success) throw new Error(result.message);
      setShowForm(false); setEditing(null); reload();
    } else {
      const fd = mkFd(data, editing?.id);
      const result = await saveIncome(null, fd);
      if (!result.success) throw new Error(result.message);
      setShowForm(false); setEditing(null); reload();
    }
  };
  const handlePay = async (data: Record<string, unknown>) => {
    if (!payTarget) return;
    const fd = mkFd({ effectiveDate: data.effectiveDate, amountUsd: data.amountUsd, amountArs: data.amountArs, exchangeRate: data.exchangeRate }, payTarget.id);
    const result = await payIncome(null, fd);
    if (!result.success) throw new Error(result.message);
    setPayTarget(null); reload();
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const fd = mkFd({}, deleteTarget.id);
    const result = await removeIncome(null, fd);
    if (!result.success) throw new Error(result.message);
    setDeleteTarget(null); reload();
  };

  const filtered = incomes.filter(inc => {
    if (filter === "PENDING" && inc.status !== "PENDING") return false;
    if (filter === "PAID" && inc.status !== "PAID") return false;
    if (filter === "OVERDUE") { if (inc.status !== "PENDING") return false; const t = new Date(); const d = inc.dueDate ? new Date(inc.dueDate) : null; return d && d < t; }
    if (typeFilter && inc.type !== typeFilter) return false;
    if (fClient && inc.clientId !== fClient) return false;
    if (fProject && inc.projectId !== fProject) return false;
    // Date range filter
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to = dateTo ? new Date(dateTo + "T00:00:00") : null;
      if (from && to && isNaN(from.getTime()) || isNaN(to ? to.getTime() : 0)) return true;
      if (from && to && from > to) return true; // invalid range, show everything
      const targetDate = inc.status === "PAID" ? inc.effectiveDate : inc.dueDate;
      if (!targetDate) return false;
      const d = new Date(targetDate);
      if (from && d < from) return false;
      if (to && d > to) return false;
    }
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
              <option value="">Tipos</option><option value="DEVELOPMENT">Desarrollo</option><option value="MAINTENANCE">Mantenimiento</option><option value="OTHER">Otro</option>
            </Select>
            <SearchableSelect value={fClient} onChange={(v) => { setFClient(v); setFProject(""); }} options={clients} placeholder="Cliente" className="w-36 text-xs" />
            <SearchableSelect value={fProject} onChange={(v) => setFProject(v)} options={projects.filter(p => !fClient || p.clientId === fClient)} placeholder="Proyecto" className="w-36 text-xs" disabled={!fClient} />
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-32 text-xs h-8" placeholder="Desde" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-32 text-xs h-8" placeholder="Hasta" />
              {(dateFrom || dateTo) && <Button variant="ghost" className="text-xs" onClick={clearRange}>Limpiar fechas</Button>}
            </div>
          </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>Nuevo ingreso</Button>
        </div>
      </div>

      {/* Filtered total */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
        <span className="text-gray-500">Total filtrado · <span className="font-medium">{filtered.length} movimientos</span></span>
        <span className="font-bold tabular-nums text-gray-900">{formatUsd(filteredTotal)}</span>
      </div>
      {(dateFrom || dateTo || filter !== "all" || typeFilter || fClient || fProject) && (
        <div className="flex items-center gap-2 flex-wrap">
          {dateFrom && dateTo && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{dateFrom.split("-").reverse().join("/")} – {dateTo.split("-").reverse().join("/")}</span>}
          {filter !== "all" && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{filter === "PAID" ? "Cobrados" : filter === "PENDING" ? "Pendientes" : "Vencidos"}</span>}
          <button onClick={clearFilters} className="text-xs text-gray-400 underline hover:text-gray-600">Limpiar filtros</button>
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden md:block">
        <DataTable tableClassName="table-fixed"
          headers={["Concepto","Cliente","Proyecto","Tipo","Estado","Fecha","USD","ARS","Acciones"]}
          colGroup={<colgroup><col style={{width:"16%"}} /><col style={{width:"14%"}} /><col style={{width:"14%"}} /><col style={{width:"8%"}} /><col style={{width:"8%"}} /><col style={{width:"9%"}} /><col style={{width:"10%"}} /><col style={{width:"10%"}} /><col style={{width:"11%"}} /></colgroup>}
          footer={<tr className="bg-gray-50 font-semibold"><td className="px-4 py-2.5 text-xs text-gray-500">Total filtrado · {filtered.length} mov.</td><td /><td /><td /><td /><td /><td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatUsd(filteredTotal)}</td><td /><td /></tr>}
        >
          {filtered.map(inc => (
            <tr key={inc.id}>
              <td className="px-4 py-2.5 text-sm align-middle"><div className="line-clamp-2 break-words" title={inc.concept}>{inc.concept}</div></td>
              <td className="px-4 py-2.5 text-sm align-middle"><div className="line-clamp-2 break-words" title={inc.client?.name ?? ""}>{inc.client?.name ?? "—"}</div></td>
              <td className="px-4 py-2.5 text-sm align-middle"><div className="line-clamp-2 break-words" title={inc.project?.name ?? ""}>{inc.project?.name ?? "—"}</div></td>
              <td className="px-4 py-2.5 text-sm whitespace-nowrap">{formatIncomeType(inc.type)}</td>
              <td className="px-4 py-2.5"><Badge tone={statusTone(inc.status, inc.dueDate)}>{statusLabel(inc.status, inc.dueDate)}</Badge></td>
              <td className="px-4 py-2.5 text-sm tabular-nums whitespace-nowrap">{inc.status === "PAID" ? formatDate(inc.effectiveDate) : formatDate(inc.dueDate)}</td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatUsd(fmt(inc.amountUsd))}</td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums">{inc.amountArs ? `${formatArs(fmt(inc.amountArs))} · TC ${fmt(inc.exchangeRate)}` : "—"}</td>
              <td className="px-4 py-2.5 space-x-1 whitespace-nowrap">
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
            {inc.amountArs && <div className="text-xs text-gray-500 text-right">{formatArs(fmt(inc.amountArs))} · TC {fmt(inc.exchangeRate)}</div>}
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
      <ConfirmActionModal open={!!deleteTarget} title={deleteTarget?.status === "PAID" ? "Eliminar ingreso cobrado" : "Eliminar ingreso"}
        description={deleteTarget?.status === "PAID" ? "Este ingreso ya esta cobrado. ¿Confirmas que queres eliminarlo?" : `¿Eliminar "${deleteTarget?.concept}"?`}
        confirmLabel="Eliminar" isPending={false} error={delError} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </div>
  );
}
