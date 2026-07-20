"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { ModalPortal } from "@/components/ui/modal-portal";
import { saveExpense, removeExpense, payExpense } from "./actions";
import { saveCategory, removeCategory } from "./categories/actions";
import { formatUsd, formatArs, formatDate, formatExpenseStatus, toInputDate } from "@/lib/utils";

type E = { id: string; type: string; concept: string; notes: string | null; status: string;
  amountUsd: any; amountArs: any; exchangeRate: any; dueDate: string | Date | null; effectiveDate: string | Date | null;
  expenseCategoryId: string; projectId: string | null;
  category: { id: string; name: string }; project: { id: string; name: string } | null; };
type Cat = { id: string; name: string; _count: { expenses: number } };
type Proj = { id: string; name: string; clientId?: string };
type Cli = { id: string; name: string };

function fmt(v: any) { return typeof v === "object" && v != null && "toString" in v ? Number(v.toString()) : Number(v ?? 0); }

export function ExpenseList({ initial, categories: cats, projects: projs, clients: cls }: { initial: E[]; categories: Cat[]; projects: Proj[]; clients: Cli[] }) {
  const [expenses] = useState<E[]>(initial);
  const [categories, setCategories] = useState<Cat[]>(cats);
  const [fStatus, setFStatus] = useState("all"); const [fType, setFType] = useState(""); const [fCat, setFCat] = useState(""); const [fProj, setFProj] = useState("");
  const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<E | null>(null);
  const [payTarget, setPayTarget] = useState<E | null>(null);
  const [delTarget, setDelTarget] = useState<E | null>(null); const [delError, setDelError] = useState<string | null>(null);
  const [showCatMgmt, setShowCatMgmt] = useState(false);
  const [catForm, setCatForm] = useState({ id: "", name: "" }); const [catError, setCatError] = useState<string | null>(null);
  const [catDelTarget, setCatDelTarget] = useState<Cat | null>(null);
  const [_, stt] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();

  const didOpen = useRef(false);
  useEffect(() => { if (!didOpen.current && sp.get("new") === "1") { didOpen.current = true; setShowForm(true); router.replace("/expenses"); } }, [sp, router]);
  // Sync filters from query params
  const didSync = useRef(false);
  useEffect(() => { if (didSync.current) return; const s = sp.get("status"); if (s === "PAID" || s === "PENDING") setFStatus(s); else if (s === "OVERDUE") setFStatus("OVERDUE"); const f = sp.get("from"), t = sp.get("to"); if (f && t) { setDateFrom(f); setDateTo(t); } didSync.current = true; }, [sp]);
  const clearRange = () => { setDateFrom(""); setDateTo(""); router.replace("/expenses"); };
  const clearFilters = () => { setFStatus("all"); setFType(""); setFCat(""); setFProj(""); clearRange(); };

  const reload = () => { setTimeout(() => window.location.reload(), 500); };

  const defaultForm = { expenseCategoryId: "", clientId: "", projectId: "", type: "FIXED", concept: "", notes: "", status: "PAID" as "PAID"|"PENDING",
    useArs: false, amountUsd: "", amountArs: "", exchangeRate: "", dueDate: "", effectiveDate: "" };
  const [form, setForm] = useState(defaultForm); const [formErr, setFormErr] = useState<string | null>(null); const [formSaving, setFormSaving] = useState(false);

  const openForm = (e?: E) => {
    if (e) {
      setEditing(e); setForm({ expenseCategoryId: e.expenseCategoryId, clientId: "", projectId: e.projectId ?? "", type: e.type, concept: e.concept, notes: e.notes ?? "", status: e.status as "PAID"|"PENDING", useArs: e.amountArs != null, amountUsd: e.amountUsd ? String(e.amountUsd) : "", amountArs: e.amountArs ? String(e.amountArs) : "", exchangeRate: e.exchangeRate ? String(e.exchangeRate) : "", dueDate: e.dueDate ? toInputDate(e.dueDate) : "", effectiveDate: e.effectiveDate ? toInputDate(e.effectiveDate) : "" });
    }
    else { setEditing(null); setForm(defaultForm); }
    setShowForm(true);
  };

  const handleFormSubmit = async (ev: React.FormEvent) => { ev.preventDefault(); setFormErr(null); setFormSaving(true);
    try { const fd = new FormData(); if (editing) fd.set("id", editing.id);
      fd.set("expenseCategoryId", form.expenseCategoryId); if (form.projectId) fd.set("projectId", form.projectId);
      fd.set("type", form.type); fd.set("concept", form.concept); if (form.notes) fd.set("notes", form.notes);
      fd.set("status", form.status); if (form.status === "PENDING") fd.set("dueDate", form.dueDate); if (form.status === "PAID") fd.set("effectiveDate", form.effectiveDate);
      if (form.useArs) { fd.set("amountArs", form.amountArs); fd.set("exchangeRate", form.exchangeRate); } else fd.set("amountUsd", form.amountUsd);
      const result = await saveExpense(null, fd);
      if (!result.success) { setFormErr(result.message); return; }
      setShowForm(false); reload();
    } catch (err) { setFormErr(err instanceof Error ? err.message : "Error."); } finally { setFormSaving(false); }
  };

  const [payForm, setPayForm] = useState({ effectiveDate: new Date().toISOString().slice(0,10), useArs: false, amountUsd: "", amountArs: "", exchangeRate: "" });
  const openPay = (e: E) => { setPayTarget(e); setPayForm({ effectiveDate: new Date().toISOString().slice(0,10), useArs: e.amountArs != null, amountUsd: e.amountUsd ? String(e.amountUsd) : "", amountArs: e.amountArs ? String(e.amountArs) : "", exchangeRate: e.exchangeRate ? String(e.exchangeRate) : "" }); };
  const handlePay = async (ev: React.FormEvent) => { ev.preventDefault(); const fd = new FormData(); fd.set("id", payTarget!.id); fd.set("effectiveDate", payForm.effectiveDate);
    if (payForm.useArs) { fd.set("amountArs", payForm.amountArs); fd.set("exchangeRate", payForm.exchangeRate); } else fd.set("amountUsd", payForm.amountUsd);
    const result = await payExpense(null, fd);
    if (result.success) { setPayTarget(null); reload(); } else { setFormErr(result.message); } };
  const handleDelete = () => { if (!delTarget) return; const fd = new FormData(); fd.set("id", delTarget.id); stt(() => { removeExpense(null, fd); }); setDelTarget(null); reload(); };
  const handleCatSave = async (ev: React.FormEvent) => { ev.preventDefault(); setCatError(null); const fd = new FormData(); if (catForm.id) fd.set("id", catForm.id); fd.set("name", catForm.name); stt(() => { saveCategory(null, fd); }); setCatForm({ id: "", name: "" }); reload(); };
  const handleCatDel = () => { if (!catDelTarget) return; const fd = new FormData(); fd.set("id", catDelTarget.id); stt(() => { removeCategory(null, fd); }); setCatDelTarget(null); reload(); };

  const filtered = expenses.filter(e => {
    if (fStatus === "PENDING" && e.status !== "PENDING") return false; if (fStatus === "PAID" && e.status !== "PAID") return false;
    if (fStatus === "OVERDUE") { if (e.status !== "PENDING") return false; const t = new Date(); const d = e.dueDate ? new Date(e.dueDate) : null; return d && d < t; }
    if (fType && e.type !== fType) return false; if (fCat && e.expenseCategoryId !== fCat) return false; if (fProj && e.projectId !== fProj) return false;
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to = dateTo ? new Date(dateTo + "T00:00:00") : null;
      if (from && to && from > to) return true;
      const targetDate = e.status === "PAID" ? e.effectiveDate : e.dueDate;
      if (!targetDate) return false;
      const d = new Date(targetDate);
      if (from && d < from) return false;
      if (to && d > to) return false;
    }
    return true;
  });

  const filteredExpTotal = filtered.reduce((s, e) => s + fmt(e.amountUsd), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-28 text-xs"><option value="all">Todos</option><option value="PAID">Pagados</option><option value="PENDING">Pendientes</option><option value="OVERDUE">Vencidos</option></Select>
          <Select value={fType} onChange={(e) => setFType(e.target.value)} className="w-24 text-xs"><option value="">Tipos</option><option value="FIXED">Fijos</option><option value="VARIABLE">Variables</option></Select>
          <Select value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-36 text-xs"><option value="">Categorias</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={fProj} onChange={(e) => setFProj(e.target.value)} className="w-36 text-xs"><option value="">Proyecto</option>{projs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <div className="flex items-center gap-1">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-32 text-xs h-8" placeholder="Desde" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-32 text-xs h-8" placeholder="Hasta" />
            {(dateFrom || dateTo) && <Button variant="ghost" className="text-xs" onClick={clearRange}>Limpiar fechas</Button>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="text-xs" onClick={() => setShowCatMgmt(true)}>Categorias</Button>
          <Button onClick={() => openForm()}>Nuevo gasto</Button>
        </div>
      </div>

      {/* Filtered total */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
        <span className="text-gray-500">Total filtrado · <span className="font-medium">{filtered.length} movimientos</span></span>
        <span className="font-bold tabular-nums text-gray-900">{formatUsd(filteredExpTotal)}</span>
      </div>
      {(dateFrom || dateTo || fStatus !== "all" || fType || fCat || fProj) && (
        <div className="flex items-center gap-2 flex-wrap">
          {dateFrom && dateTo && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{dateFrom.split("-").reverse().join("/")} – {dateTo.split("-").reverse().join("/")}</span>}
          {fStatus !== "all" && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{fStatus === "PAID" ? "Pagados" : fStatus === "PENDING" ? "Pendientes" : "Vencidos"}</span>}
          <button onClick={clearFilters} className="text-xs text-gray-400 underline hover:text-gray-600">Limpiar filtros</button>
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden md:block">
        <DataTable tableClassName="table-fixed"
          headers={["Concepto","Categoria","Proyecto","Tipo","Estado","Fecha","USD","ARS","Acciones"]}
          colGroup={<colgroup><col style={{width:"16%"}} /><col style={{width:"14%"}} /><col style={{width:"14%"}} /><col style={{width:"7%"}} /><col style={{width:"8%"}} /><col style={{width:"9%"}} /><col style={{width:"10%"}} /><col style={{width:"10%"}} /><col style={{width:"12%"}} /></colgroup>}
          footer={<tr className="bg-gray-50 font-semibold"><td className="px-4 py-2.5 text-xs text-gray-500">Total filtrado · {filtered.length} mov.</td><td /><td /><td /><td /><td /><td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatUsd(filteredExpTotal)}</td><td /><td /></tr>}
        >
          {filtered.map(e => (
            <tr key={e.id}>
              <td className="px-4 py-2.5 text-sm align-middle"><div className="line-clamp-2 break-words" title={e.concept}>{e.concept}</div></td>
              <td className="px-4 py-2.5 text-sm align-middle"><div className="line-clamp-2 break-words" title={e.category.name}>{e.category.name}</div></td>
              <td className="px-4 py-2.5 text-sm align-middle"><div className="line-clamp-2 break-words" title={e.project?.name ?? ""}>{e.project?.name ?? "—"}</div></td>
              <td className="px-4 py-2.5 text-sm whitespace-nowrap">{e.type === "FIXED" ? "Fijo" : "Variable"}</td>
              <td className="px-4 py-2.5"><Badge tone={formatExpenseStatus(e.status, e.dueDate) === "Pagado" ? "success" : formatExpenseStatus(e.status, e.dueDate) === "Vencido" ? "danger" : "warning"}>{formatExpenseStatus(e.status, e.dueDate)}</Badge></td>
              <td className="px-4 py-2.5 text-sm tabular-nums whitespace-nowrap">{e.status === "PAID" ? formatDate(e.effectiveDate) : formatDate(e.dueDate)}</td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatUsd(fmt(e.amountUsd))}</td>
              <td className="px-4 py-2.5 text-sm text-right tabular-nums">{e.amountArs ? `${formatArs(fmt(e.amountArs))} · TC ${fmt(e.exchangeRate)}` : "—"}</td>
              <td className="px-4 py-2.5 space-x-1 whitespace-nowrap">
                {e.status === "PENDING" && <Button variant="secondary" className="text-xs" onClick={() => openPay(e)}>Pagar</Button>}
                <Button variant="secondary" className="text-xs" onClick={() => openForm(e)}>Editar</Button>
                <Button variant="secondary" className="text-xs text-brick" onClick={() => { setDelTarget(e); setDelError(null); }}>Elim.</Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* MOBILE CARDS */}
      <div className="space-y-2 md:hidden">
        {filtered.map(e => (
          <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{e.concept}</span>
              <Badge tone={formatExpenseStatus(e.status, e.dueDate) === "Pagado" ? "success" : formatExpenseStatus(e.status, e.dueDate) === "Vencido" ? "danger" : "warning"}>{formatExpenseStatus(e.status, e.dueDate)}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{e.category.name}{e.type === "FIXED" ? " · Fijo" : " · Variable"}</span>
              <span className="font-semibold tabular-nums">{formatUsd(fmt(e.amountUsd))}</span>
            </div>
            <div className="text-xs text-gray-400 flex justify-between">
              <span>{e.project?.name ?? "Sin proyecto"}</span>
              <span>{e.status === "PAID" ? formatDate(e.effectiveDate) : formatDate(e.dueDate)}</span>
            </div>
            {e.amountArs && <div className="text-xs text-gray-500 text-right">{formatArs(fmt(e.amountArs))} · TC {fmt(e.exchangeRate)}</div>}
            <div className="flex gap-1 pt-1">
              {e.status === "PENDING" && <Button variant="secondary" className="text-xs flex-1" onClick={() => openPay(e)}>Pagar</Button>}
              <Button variant="secondary" className="text-xs flex-1" onClick={() => openForm(e)}>Editar</Button>
              <Button variant="secondary" className="text-xs flex-1 text-brick" onClick={() => { setDelTarget(e); setDelError(null); }}>Elim.</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Sin gastos.</p>}
      </div>

      {/* Expense form modal */}
      {showForm && <ModalPortal><div className="fixed inset-0 z-[90] overflow-y-auto"><button className="fixed inset-0 bg-black/50" onClick={() => setShowForm(false)} /><div className="relative flex min-h-full items-center justify-center p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl overflow-x-hidden"><h2 className="text-lg font-bold">{editing ? "Editar gasto" : "Nuevo gasto"}</h2>
      <form onSubmit={handleFormSubmit} className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto">
        <Select value={form.expenseCategoryId} onChange={(e) => setForm(p => ({...p, expenseCategoryId: e.target.value}))} required><option value="">Categoria *</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={form.clientId} onChange={(e) => setForm(p => ({...p, clientId: e.target.value, projectId: ""}))}><option value="">Cliente</option>{cls.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={form.projectId} onChange={(e) => setForm(p => ({...p, projectId: e.target.value}))} disabled={!form.clientId}><option value="">Proyecto</option>{projs.filter(p => !form.clientId || p.id === form.projectId || p.clientId === form.clientId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={form.type} onChange={(e) => setForm(p => ({...p, type: e.target.value}))}><option value="FIXED">Fijo</option><option value="VARIABLE">Variable</option></Select>
        <Input placeholder="Concepto *" value={form.concept} onChange={(e) => setForm(p => ({...p, concept: e.target.value}))} required />
        <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm(p => ({...p, notes: e.target.value}))} />
        <Select value={form.status} onChange={(e) => setForm(p => ({...p, status: e.target.value as "PAID"|"PENDING"}))}><option value="PAID">Pagado</option><option value="PENDING">Pendiente</option></Select>
        {form.status === "PENDING" && <Input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({...p, dueDate: e.target.value}))} required />}
        {form.status === "PAID" && <Input type="date" value={form.effectiveDate} onChange={(e) => setForm(p => ({...p, effectiveDate: e.target.value}))} required />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useArs} onChange={(e) => setForm(p => ({...p, useArs: e.target.checked}))} />Cargar en ARS</label>
        {form.useArs ? (<><Input placeholder="ARS" type="number" step="any" value={form.amountArs} onChange={(e) => setForm(p => ({...p, amountArs: e.target.value}))} /><Input placeholder="TC" type="number" step="any" value={form.exchangeRate} onChange={(e) => setForm(p => ({...p, exchangeRate: e.target.value}))} /></>) : (<Input placeholder="USD" type="number" step="any" value={form.amountUsd} onChange={(e) => setForm(p => ({...p, amountUsd: e.target.value}))} />)}
        {formErr && <p className="text-sm text-red-600">{formErr}</p>}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={formSaving}>Guardar</Button></div>
      </form></div></div></div></ModalPortal>}

      {/* Pay modal */}
      {payTarget && <ModalPortal><div className="fixed inset-0 z-[90] overflow-y-auto"><button className="fixed inset-0 bg-black/50" onClick={() => setPayTarget(null)} /><div className="relative flex min-h-full items-center justify-center p-4"><div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl overflow-x-hidden"><h2 className="text-lg font-bold">Pagar</h2><p className="text-sm text-gray-500 mt-1">{payTarget.concept}</p>
      <form onSubmit={handlePay} className="mt-4 space-y-3">
        <Input type="date" value={payForm.effectiveDate} onChange={(e) => setPayForm(p => ({...p, effectiveDate: e.target.value}))} required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={payForm.useArs} onChange={(e) => setPayForm(p => ({...p, useArs: e.target.checked}))} />ARS</label>
        {payForm.useArs ? (<><Input placeholder="ARS" type="number" step="any" value={payForm.amountArs} onChange={(e) => setPayForm(p => ({...p, amountArs: e.target.value}))} /><Input placeholder="TC" type="number" step="any" value={payForm.exchangeRate} onChange={(e) => setPayForm(p => ({...p, exchangeRate: e.target.value}))} /></>) : (<Input placeholder="USD" type="number" step="any" value={payForm.amountUsd} onChange={(e) => setPayForm(p => ({...p, amountUsd: e.target.value}))} />)}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setPayTarget(null)}>Cancelar</Button><Button type="submit">Pagar</Button></div>
      </form></div></div></div></ModalPortal>}

      {/* Category management */}
      {showCatMgmt && <ModalPortal><div className="fixed inset-0 z-[90] overflow-y-auto"><button className="fixed inset-0 bg-black/50" onClick={() => setShowCatMgmt(false)} /><div className="relative flex min-h-full items-center justify-center p-4"><div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl overflow-x-hidden"><h2 className="text-lg font-bold">Categorias</h2>
      <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">{categories.map(c => <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm"><span>{c.name} <span className="text-gray-400">({c._count.expenses})</span></span><div className="space-x-1"><Button variant="secondary" className="text-xs" onClick={() => setCatForm({ id: c.id, name: c.name })}>Editar</Button><Button variant="secondary" className="text-xs text-brick" onClick={() => setCatDelTarget(c)}>Elim.</Button></div></div>)}</div>
      <form onSubmit={handleCatSave} className="mt-3 flex gap-2"><Input placeholder="Nombre" value={catForm.name} onChange={(e) => setCatForm(p => ({...p, name: e.target.value}))} required /><Button type="submit" className="text-xs">{catForm.id ? "Guardar" : "Crear"}</Button></form>
      {catError && <p className="text-sm text-red-600 mt-1">{catError}</p>}
      <div className="flex justify-end mt-3"><Button variant="ghost" onClick={() => { setShowCatMgmt(false); setCatForm({ id: "", name: "" }); }}>Cerrar</Button></div>
      </div></div></div></ModalPortal>}

      <ConfirmActionModal open={!!delTarget} title={delTarget?.status === "PAID" ? "Eliminar gasto pagado" : "Eliminar gasto"} description={delTarget?.status === "PAID" ? "Este gasto ya esta pagado. ¿Confirmas?" : `¿Eliminar "${delTarget?.concept}"?`} confirmLabel="Eliminar" isPending={false} error={delError} onClose={() => setDelTarget(null)} onConfirm={handleDelete} />
      <ConfirmActionModal open={!!catDelTarget} title="Eliminar categoria" description={`¿Eliminar "${catDelTarget?.name}"?`} confirmLabel="Eliminar" isPending={false} error={null} onClose={() => setCatDelTarget(null)} onConfirm={handleCatDel} />
    </div>
  );
}
