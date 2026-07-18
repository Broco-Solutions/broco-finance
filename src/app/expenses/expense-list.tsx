"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { ModalPortal } from "@/components/ui/modal-portal";
import { saveExpense, removeExpense, payExpense } from "./actions";
import { saveCategory, removeCategory } from "./categories/actions";

type E = { id: string; type: string; concept: string; notes: string | null; status: string;
  amountUsd: { toString(): string } | number | string;
  amountArs: { toString(): string } | number | string | null;
  exchangeRate: { toString(): string } | number | string | null;
  dueDate: string | Date | null; effectiveDate: string | Date | null;
  expenseCategoryId: string; projectId: string | null;
  category: { id: string; name: string }; project: { id: string; name: string } | null; };
type Cat = { id: string; name: string; _count: { expenses: number } };
type Proj = { id: string; name: string };

function fd(d: string | Date | null) { if (!d) return "—"; return d instanceof Date ? d.toISOString().slice(0, 10) : d.slice(0, 10); }
function fu(v: { toString(): string } | number | string | null) { if (v == null) return "—"; return Number(typeof v === "object" ? v.toString() : v).toFixed(2); }
function sl(s: string, d: string | Date | null) { if (s === "PAID") return "Pagado"; if (s === "PENDING") { const t = new Date(); const dd = d ? new Date(d) : null; return dd && dd < t ? "Vencido" : "Pendiente"; } return s; }
function st(s: string, d: string | Date | null) { const l = sl(s, d); if (l === "Pagado") return "success" as const; if (l === "Vencido") return "danger" as const; return "warning" as const; }

export function ExpenseList({ initial, categories: cats, projects: projs }: { initial: E[]; categories: Cat[]; projects: Proj[] }) {
  const [expenses] = useState<E[]>(initial);
  const [categories, setCategories] = useState<Cat[]>(cats);
  const [fStatus, setFStatus] = useState("all"); const [fType, setFType] = useState(""); const [fCat, setFCat] = useState(""); const [fProj, setFProj] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<E | null>(null);
  const [payTarget, setPayTarget] = useState<E | null>(null);
  const [delTarget, setDelTarget] = useState<E | null>(null); const [delError, setDelError] = useState<string | null>(null);
  const [showCatMgmt, setShowCatMgmt] = useState(false);
  const [catForm, setCatForm] = useState({ id: "", name: "" }); const [catError, setCatError] = useState<string | null>(null);
  const [catDelTarget, setCatDelTarget] = useState<Cat | null>(null);
  const [_, stt] = useTransition();
  const reload = () => { setTimeout(() => window.location.reload(), 500); };

  // ---- Form state ----
  const defaultForm = { expenseCategoryId: "", projectId: "", type: "FIXED", concept: "", notes: "", status: "PAID" as "PAID"|"PENDING",
    useArs: false, amountUsd: "", amountArs: "", exchangeRate: "", dueDate: "", effectiveDate: "" };
  const [form, setForm] = useState(defaultForm);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const openForm = (e?: E) => {
    if (e) {
      setEditing(e);
      setForm({ expenseCategoryId: e.expenseCategoryId, projectId: e.projectId ?? "", type: e.type, concept: e.concept, notes: e.notes ?? "",
        status: e.status as "PAID"|"PENDING", useArs: e.amountArs != null, amountUsd: e.amountUsd ? String(e.amountUsd) : "",
        amountArs: e.amountArs ? String(e.amountArs) : "", exchangeRate: e.exchangeRate ? String(e.exchangeRate) : "",
        dueDate: e.dueDate ? fd(e.dueDate) : "", effectiveDate: e.effectiveDate ? fd(e.effectiveDate) : "" });
    } else { setEditing(null); setForm(defaultForm); }
    setShowForm(true);
  };

  const handleFormSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setFormErr(null); setFormSaving(true);
    try {
      const fd = new FormData();
      if (editing) fd.set("id", editing.id);
      fd.set("expenseCategoryId", form.expenseCategoryId); if (form.projectId) fd.set("projectId", form.projectId);
      fd.set("type", form.type); fd.set("concept", form.concept); if (form.notes) fd.set("notes", form.notes);
      fd.set("status", form.status);
      if (form.status === "PENDING") fd.set("dueDate", form.dueDate);
      if (form.status === "PAID") fd.set("effectiveDate", form.effectiveDate);
      if (form.useArs) { fd.set("amountArs", form.amountArs); fd.set("exchangeRate", form.exchangeRate); }
      else fd.set("amountUsd", form.amountUsd);
      stt(() => { saveExpense(null, fd); });
      setShowForm(false); reload();
    } catch (err) { setFormErr(err instanceof Error ? err.message : "Error."); }
    finally { setFormSaving(false); }
  };

  // ---- Pay ----
  const [payForm, setPayForm] = useState({ effectiveDate: new Date().toISOString().slice(0,10), useArs: false, amountUsd: "", amountArs: "", exchangeRate: "" });
  const openPay = (e: E) => { setPayTarget(e); setPayForm({ effectiveDate: new Date().toISOString().slice(0,10), useArs: e.amountArs != null, amountUsd: e.amountUsd ? String(e.amountUsd) : "", amountArs: e.amountArs ? String(e.amountArs) : "", exchangeRate: e.exchangeRate ? String(e.exchangeRate) : "" }); };
  const handlePay = async (ev: React.FormEvent) => { ev.preventDefault(); const fd = new FormData(); fd.set("id", payTarget!.id); fd.set("effectiveDate", payForm.effectiveDate);
    if (payForm.useArs) { fd.set("amountArs", payForm.amountArs); fd.set("exchangeRate", payForm.exchangeRate); } else fd.set("amountUsd", payForm.amountUsd);
    stt(() => { payExpense(null, fd); }); setPayTarget(null); reload(); };

  // ---- Delete ----
  const handleDelete = () => { if (!delTarget) return; const fd = new FormData(); fd.set("id", delTarget.id); stt(() => { removeExpense(null, fd); }); setDelTarget(null); reload(); };

  // ---- Category management ----
  const handleCatSave = async (ev: React.FormEvent) => { ev.preventDefault(); setCatError(null); const fd = new FormData(); if (catForm.id) fd.set("id", catForm.id); fd.set("name", catForm.name);
    stt(() => { saveCategory(null, fd); }); setCatForm({ id: "", name: "" }); reload(); };
  const handleCatDel = () => { if (!catDelTarget) return; const fd = new FormData(); fd.set("id", catDelTarget.id); stt(() => { removeCategory(null, fd); }); setCatDelTarget(null); reload(); };

  // ---- Filter ----
  const filtered = expenses.filter((e) => {
    if (fStatus === "PENDING" && e.status !== "PENDING") return false;
    if (fStatus === "PAID" && e.status !== "PAID") return false;
    if (fStatus === "OVERDUE") { if (e.status !== "PENDING") return false; const t = new Date(); const d = e.dueDate ? new Date(e.dueDate) : null; return d && d < t; }
    if (fType && e.type !== fType) return false;
    if (fCat && e.expenseCategoryId !== fCat) return false;
    if (fProj && e.projectId !== fProj) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-32"><option value="all">Todos</option><option value="PAID">Pagados</option><option value="PENDING">Pendientes</option><option value="OVERDUE">Vencidos</option></Select>
          <Select value={fType} onChange={(e) => setFType(e.target.value)} className="w-28"><option value="">Tipos</option><option value="FIXED">Fijos</option><option value="VARIABLE">Variables</option></Select>
          <Select value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-40"><option value="">Categorias</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={fProj} onChange={(e) => setFProj(e.target.value)} className="w-40"><option value="">Proyectos</option>{projs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCatMgmt(true)}>Categorias</Button>
          <Button onClick={() => openForm()}>Nuevo gasto</Button>
        </div>
      </div>

      <DataTable headers={["Concepto", "Categoria", "Proyecto", "Tipo", "Estado", "Fecha", "USD", "ARS", "Acciones"]}>
        {filtered.map((e) => (
          <tr key={e.id}>
            <td className="px-4 py-3">{e.concept}</td><td className="px-4 py-3">{e.category.name}</td><td className="px-4 py-3">{e.project?.name ?? "—"}</td>
            <td className="px-4 py-3">{e.type === "FIXED" ? "Fijo" : "Variable"}</td>
            <td className="px-4 py-3"><Badge tone={st(e.status, e.dueDate)}>{sl(e.status, e.dueDate)}</Badge></td>
            <td className="px-4 py-3">{e.status === "PAID" ? fd(e.effectiveDate) : fd(e.dueDate)}</td>
            <td className="px-4 py-3">{fu(e.amountUsd)}</td><td className="px-4 py-3">{fu(e.amountArs)}</td>
            <td className="px-4 py-3 space-x-1">
              {e.status === "PENDING" && <Button variant="secondary" onClick={() => openPay(e)}>Pagar</Button>}
              <Button variant="secondary" onClick={() => openForm(e)}>Editar</Button>
              <Button variant="secondary" className="text-brick" onClick={() => { setDelTarget(e); setDelError(null); }}>Elim.</Button>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* Expense form modal */}
      {showForm && <ModalPortal><div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6"><button className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setShowForm(false)} /><div className="relative flex min-h-full items-start justify-center sm:items-center"><div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]"><h2 className="font-display text-2xl text-ink">{editing ? "Editar gasto" : "Nuevo gasto"}</h2>
      <form onSubmit={handleFormSubmit} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <Select value={form.expenseCategoryId} onChange={(e) => setForm(p => ({...p, expenseCategoryId: e.target.value}))} required><option value="">Categoria *</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={form.projectId} onChange={(e) => setForm(p => ({...p, projectId: e.target.value}))}><option value="">Sin proyecto</option>{projs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={form.type} onChange={(e) => setForm(p => ({...p, type: e.target.value}))}><option value="FIXED">Fijo</option><option value="VARIABLE">Variable</option></Select>
        <Input placeholder="Concepto *" value={form.concept} onChange={(e) => setForm(p => ({...p, concept: e.target.value}))} required />
        <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm(p => ({...p, notes: e.target.value}))} />
        <Select value={form.status} onChange={(e) => setForm(p => ({...p, status: e.target.value as "PAID"|"PENDING"}))}><option value="PAID">Pagado</option><option value="PENDING">Pendiente</option></Select>
        {form.status === "PENDING" && <Input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({...p, dueDate: e.target.value}))} required />}
        {form.status === "PAID" && <Input type="date" value={form.effectiveDate} onChange={(e) => setForm(p => ({...p, effectiveDate: e.target.value}))} required />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useArs} onChange={(e) => setForm(p => ({...p, useArs: e.target.checked}))} />Cargar en ARS</label>
        {form.useArs ? (<div className="space-y-2 pl-4 border-l-2 border-cobalt/20"><Input placeholder="Monto ARS" type="number" step="any" value={form.amountArs} onChange={(e) => setForm(p => ({...p, amountArs: e.target.value}))} required /><Input placeholder="Tipo de cambio" type="number" step="any" value={form.exchangeRate} onChange={(e) => setForm(p => ({...p, exchangeRate: e.target.value}))} required /></div>) : (<Input placeholder="Monto USD" type="number" step="any" value={form.amountUsd} onChange={(e) => setForm(p => ({...p, amountUsd: e.target.value}))} required />)}
        {formErr && <p className="text-sm text-brick">{formErr}</p>}
        <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={formSaving}>{formSaving ? "Guardando..." : "Guardar"}</Button></div>
      </form></div></div></div></ModalPortal>}

      {/* Pay modal */}
      {payTarget && <ModalPortal><div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6"><button className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setPayTarget(null)} /><div className="relative flex min-h-full items-start justify-center sm:items-center"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]"><h2 className="font-display text-2xl text-ink">Marcar como pagado</h2><p className="mt-2 text-sm text-ink/50">{payTarget.concept}</p>
      <form onSubmit={handlePay} className="mt-4 space-y-4">
        <Input type="date" value={payForm.effectiveDate} onChange={(e) => setPayForm(p => ({...p, effectiveDate: e.target.value}))} required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={payForm.useArs} onChange={(e) => setPayForm(p => ({...p, useArs: e.target.checked}))} />Cargar en ARS</label>
        {payForm.useArs ? (<><Input placeholder="Monto ARS" type="number" step="any" value={payForm.amountArs} onChange={(e) => setPayForm(p => ({...p, amountArs: e.target.value}))} /><Input placeholder="Tipo de cambio" type="number" step="any" value={payForm.exchangeRate} onChange={(e) => setPayForm(p => ({...p, exchangeRate: e.target.value}))} /></>) : (<Input placeholder="Monto USD" type="number" step="any" value={payForm.amountUsd} onChange={(e) => setPayForm(p => ({...p, amountUsd: e.target.value}))} />)}
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setPayTarget(null)}>Cancelar</Button><Button type="submit">Pagar</Button></div>
      </form></div></div></div></ModalPortal>}

      {/* Category management modal */}
      {showCatMgmt && <ModalPortal><div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6"><button className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setShowCatMgmt(false)} /><div className="relative flex min-h-full items-start justify-center sm:items-center"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]"><h2 className="font-display text-2xl text-ink">Categorias</h2>
      <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">{categories.map(c => <div key={c.id} className="flex items-center justify-between rounded-lg border border-black/10 p-2"><span className="text-sm">{c.name} <span className="text-ink/40">({c._count.expenses})</span></span><div className="space-x-1"><Button variant="secondary" onClick={() => setCatForm({ id: c.id, name: c.name })}>Editar</Button><Button variant="secondary" className="text-brick" onClick={() => setCatDelTarget(c)}>Eliminar</Button></div></div>)}</div>
      <form onSubmit={handleCatSave} className="mt-4 flex gap-2"><Input placeholder="Nombre" value={catForm.name} onChange={(e) => setCatForm(p => ({...p, name: e.target.value}))} required /><Button type="submit">{catForm.id ? "Guardar" : "Crear"}</Button></form>
      {catError && <p className="text-sm text-brick mt-2">{catError}</p>}
      <div className="flex justify-end mt-4"><Button variant="ghost" onClick={() => { setShowCatMgmt(false); setCatForm({ id: "", name: "" }); }}>Cerrar</Button></div>
      </div></div></div></ModalPortal>}

      <ConfirmActionModal open={!!delTarget} title={delTarget?.status === "PAID" ? "Eliminar gasto pagado" : "Eliminar gasto"} description={delTarget?.status === "PAID" ? "Este gasto ya esta pagado. ¿Confirmas que queres eliminarlo?" : `¿Eliminar "${delTarget?.concept}"?`} confirmLabel="Eliminar" isPending={false} error={delError} onClose={() => setDelTarget(null)} onConfirm={handleDelete} />
      <ConfirmActionModal open={!!catDelTarget} title="Eliminar categoria" description={`¿Eliminar "${catDelTarget?.name}"?`} confirmLabel="Eliminar" isPending={false} error={null} onClose={() => setCatDelTarget(null)} onConfirm={handleCatDel} />
    </div>
  );
}
