"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalPortal } from "@/components/ui/modal-portal";

export function InstallmentModal({
  open, onClose, onSave,
}: {
  open: boolean; onClose: () => void; onSave: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    projectId: "", type: "DEVELOPMENT", concept: "", count: "3", firstDueDate: "",
    useArs: false, amountUsd: "", amountArs: "", exchangeRate: "", notes: "",
  });
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (open && !loaded) {
    setLoaded(true);
    fetch("/api/projects").then((r) => r.ok ? r.json() : null)
      .then((j) => j && setProjects(j.data ?? [])).catch(() => {});
  }

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
          <div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)]">
            <h2 className="font-display text-2xl text-ink">Generar cuotas</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Select value={form.projectId} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))} required>
                <option value="">Proyecto *</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="DEVELOPMENT">Desarrollo</option>
                <option value="MAINTENANCE">Mantenimiento</option>
              </Select>
              <Input placeholder="Concepto *" value={form.concept} onChange={(e) => setForm((p) => ({ ...p, concept: e.target.value }))} required />
              <Input placeholder="Cantidad (1-60)" type="number" min="1" max="60" value={form.count} onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))} required />
              <Input type="date" value={form.firstDueDate} onChange={(e) => setForm((p) => ({ ...p, firstDueDate: e.target.value }))} required />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.useArs} onChange={(e) => setForm((p) => ({ ...p, useArs: e.target.checked }))} />
                Cargar en ARS
              </label>
              {form.useArs ? (
                <div className="space-y-2 pl-4 border-l-2 border-cobalt/20">
                  <Input placeholder="Monto ARS por cuota" type="number" step="any" value={form.amountArs} onChange={(e) => setForm((p) => ({ ...p, amountArs: e.target.value }))} required />
                  <Input placeholder="Tipo de cambio" type="number" step="any" value={form.exchangeRate} onChange={(e) => setForm((p) => ({ ...p, exchangeRate: e.target.value }))} required />
                </div>
              ) : (
                <Input placeholder="Monto USD por cuota" type="number" step="any" value={form.amountUsd} onChange={(e) => setForm((p) => ({ ...p, amountUsd: e.target.value }))} required />
              )}
              <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              {error && <p className="text-sm text-brick">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Generando..." : "Generar"}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
