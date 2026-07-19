"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalPortal } from "@/components/ui/modal-portal";

type PO = { id: string; name: string; clientId?: string };
type CO = { id: string; name: string };
type Row = { status: "PAID"|"PENDING"; date: string; amountUsd: string; amountArs: string; exchangeRate: string };

export function IncomeFormModal({
  open, onClose, onSave, initial, title, projects, clients,
}: {
  open: boolean; onClose: () => void; onSave: (d: Record<string, unknown>) => Promise<void>;
  initial?: { id?: string; type?: string; concept?: string; notes?: string | null; status?: string;
    projectId?: string | null; clientId?: string | null;
    amountUsd?: { toString(): string } | number | string | null;
    amountArs?: { toString(): string } | number | string | null;
    exchangeRate?: { toString(): string } | number | string | null;
    dueDate?: string | null; effectiveDate?: string | null;
    client?: CO | null; project?: PO | null; };
  title: string; projects: PO[]; clients: CO[];
}) {
  const [form, setForm] = useState({
    type: initial?.type ?? "DEVELOPMENT",
    concept: initial?.concept ?? "",
    notes: initial?.notes ?? "",
    status: (initial?.status ?? "PAID") as "PAID" | "PENDING",
    projectId: initial?.projectId ?? "",
    clientId: initial?.clientId ?? "",
    useArs: initial?.amountArs != null || initial?.exchangeRate != null,
    amountUsd: initial?.amountUsd ? String(initial?.amountUsd) : "",
    amountArs: initial?.amountArs ? String(initial?.amountArs) : "",
    exchangeRate: initial?.exchangeRate ? String(initial?.exchangeRate) : "",
    dueDate: initial?.dueDate ?? "",
    effectiveDate: initial?.effectiveDate ?? "",
  });
  const [multi, setMulti] = useState(false);
  const [count, setCount] = useState(3);
  const [interval, setInterval] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsProject = form.type === "DEVELOPMENT" || form.type === "MAINTENANCE";

  const initRows = () => {
    const baseDate = form.status === "PAID" ? form.effectiveDate : form.dueDate;
    const d = new Date(baseDate || new Date().toISOString().slice(0,10));
    const arr: Row[] = [];
    for (let i = 0; i < count; i++) {
      const rd = new Date(d.getTime() + i * interval * 86400000);
      arr.push({
        status: form.status,
        date: rd.toISOString().slice(0, 10),
        amountUsd: form.amountUsd,
        amountArs: form.amountArs,
        exchangeRate: form.exchangeRate,
      });
    }
    setRows(arr);
  };

  const updateRow = (i: number, f: Partial<Row>) => {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, ...f } : r));
  };
  const removeRow = (i: number) => { if (rows.length > 2) setRows(prev => prev.filter((_, j) => j !== i)); };
  const addRow = () => {
    const last = rows[rows.length - 1];
    const d = last ? new Date(last.date) : new Date();
    d.setDate(d.getDate() + interval);
    setRows(prev => [...prev, { ...(last || { status: form.status, date: "", amountUsd: form.amountUsd, amountArs: form.amountArs, exchangeRate: form.exchangeRate }), date: d.toISOString().slice(0, 10) }]);
  };

  const totalUsd = rows.reduce((s, r) => s + (Number(r.amountUsd) || 0), 0);
  const totalArs = rows.reduce((s, r) => s + (Number(r.amountArs) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaving(true);
    try {
      if (multi) {
        await onSave({ ...form, batch: rows.map(r => ({ ...r, amountUsd: r.amountUsd || undefined, amountArs: r.amountArs || undefined, exchangeRate: form.useArs ? r.exchangeRate || undefined : undefined })) });
      } else {
        await onSave(form);
      }
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error."); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6">
        <button className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex min-h-full items-start justify-center sm:items-center">
          <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
            <h2 className="font-display text-2xl text-ink">{title}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="DEVELOPMENT">Desarrollo</option>
                <option value="MAINTENANCE">Mantenimiento</option>
                <option value="OTHER">Otro</option>
              </Select>
              <Select value={form.projectId} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))} required={needsProject}>
                <option value="">{needsProject ? "Seleccionar proyecto *" : "Sin proyecto"}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              {form.type === "OTHER" && !form.projectId && (
                <Select value={form.clientId} onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}>
                  <option value="">Sin cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
              <Input placeholder="Concepto *" value={form.concept} onChange={(e) => setForm((p) => ({ ...p, concept: e.target.value }))} required />
              <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

              {!multi && (
                <>
                  <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "PAID" | "PENDING" }))}>
                    <option value="PAID">Cobrado</option>
                    <option value="PENDING">Pendiente</option>
                  </Select>
                  {form.status === "PENDING" && <Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} required />}
                  {form.status === "PAID" && <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))} required />}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.useArs} onChange={(e) => setForm((p) => ({ ...p, useArs: e.target.checked }))} /> Cargar en ARS
                  </label>
                  {form.useArs ? (
                    <div className="space-y-2 pl-4 border-l-2 border-cobalt/20">
                      <Input placeholder="Monto ARS" type="number" step="any" value={form.amountArs} onChange={(e) => setForm((p) => ({ ...p, amountArs: e.target.value }))} required />
                      <Input placeholder="Tipo de cambio" type="number" step="any" value={form.exchangeRate} onChange={(e) => setForm((p) => ({ ...p, exchangeRate: e.target.value }))} required />
                    </div>
                  ) : (
                    <Input placeholder="Monto USD" type="number" step="any" value={form.amountUsd} onChange={(e) => setForm((p) => ({ ...p, amountUsd: e.target.value }))} required />
                  )}
                </>
              )}

              {/* Multi-income checkbox */}
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={multi} onChange={(e) => { setMulti(e.target.checked); if (e.target.checked) { setCount(3); setInterval(30); setTimeout(initRows, 0); } }} />
                Agregar varios ingresos
              </label>

              {multi && (
                <div className="space-y-3 pl-4 border-l-2 border-brand/20">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Cantidad (2-24)</label>
                      <Input type="number" min={2} max={24} value={String(count)} onChange={(e) => { const v = Math.min(24, Math.max(2, Number(e.target.value)||2)); setCount(v); }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Intervalo (días)</label>
                      <Input type="number" min={1} value={String(interval)} onChange={(e) => setInterval(Math.max(1, Number(e.target.value)||1))} />
                    </div>
                  </div>
                  <Button variant="secondary" type="button" className="text-xs" onClick={initRows}>Aplicar intervalo</Button>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.useArs} onChange={(e) => setForm((p) => ({ ...p, useArs: e.target.checked }))} /> Cargar en ARS
                  </label>

                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="flex gap-1 items-center text-xs border rounded-lg p-1.5 bg-gray-50">
                        <span className="w-5 text-gray-400">{i+1}</span>
                        <Select value={r.status} onChange={(e) => updateRow(i, { status: e.target.value as "PAID"|"PENDING" })} className="w-20 text-xs h-7">
                          <option value="PAID">Cobrado</option>
                          <option value="PENDING">Pendiente</option>
                        </Select>
                        <Input type="date" value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} className="w-32 text-xs h-7" />
                        {form.useArs ? (
                          <>
                            <Input type="number" step="any" value={r.amountArs} onChange={(e) => updateRow(i, { amountArs: e.target.value })} className="w-24 text-xs h-7" placeholder="ARS" />
                            <Input type="number" step="any" value={r.exchangeRate} onChange={(e) => updateRow(i, { exchangeRate: e.target.value })} className="w-20 text-xs h-7" placeholder="TC" />
                          </>
                        ) : (
                          <Input type="number" step="any" value={r.amountUsd} onChange={(e) => updateRow(i, { amountUsd: e.target.value })} className="w-24 text-xs h-7" placeholder="USD" />
                        )}
                        <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-lg leading-none px-1" title="Eliminar fila">×</button>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" type="button" className="text-xs" onClick={addRow}>+ Agregar fila</Button>

                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                    Se crearán {rows.length} ingresos
                    {form.useArs ? ` — Total ARS ${totalArs.toLocaleString("es-AR")}` : ` — Total USD ${totalUsd.toLocaleString("es-AR", {minimumFractionDigits:2})}`}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-brick">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : multi ? `Guardar ${rows.length} ingresos` : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
