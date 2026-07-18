"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalPortal } from "@/components/ui/modal-portal";

type PO = { id: string; name: string; clientId?: string };
type CO = { id: string; name: string };

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsProject = form.type === "DEVELOPMENT" || form.type === "MAINTENANCE";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error."); }
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
              <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "PAID" | "PENDING" }))}>
                <option value="PAID">Cobrado</option>
                <option value="PENDING">Pendiente</option>
              </Select>
              {form.status === "PENDING" && (
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} required />
              )}
              {form.status === "PAID" && (
                <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))} required />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.useArs} onChange={(e) => setForm((p) => ({ ...p, useArs: e.target.checked }))} />
                Cargar en ARS
              </label>
              {form.useArs ? (
                <div className="space-y-2 pl-4 border-l-2 border-cobalt/20">
                  <Input placeholder="Monto ARS" type="number" step="any" value={form.amountArs} onChange={(e) => setForm((p) => ({ ...p, amountArs: e.target.value }))} required />
                  <Input placeholder="Tipo de cambio" type="number" step="any" value={form.exchangeRate} onChange={(e) => setForm((p) => ({ ...p, exchangeRate: e.target.value }))} required />
                </div>
              ) : (
                <Input placeholder="Monto USD" type="number" step="any" value={form.amountUsd} onChange={(e) => setForm((p) => ({ ...p, amountUsd: e.target.value }))} required />
              )}
              {error && <p className="text-sm text-brick">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
