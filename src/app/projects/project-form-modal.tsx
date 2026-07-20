"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalPortal } from "@/components/ui/modal-portal";

type ClientOption = { id: string; name: string };

export function ProjectFormModal({
  open,
  onClose,
  onSave,
  initial,
  title,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  initial?: {
    id?: string;
    name?: string;
    clientId?: string;
    isActive?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    oneTimeOriginalAmount?: string | number | null;
    oneTimeCurrency?: string | null;
    oneTimeExchangeRate?: string | number | null;
    oneTimeAmountUsd?: string | number | null;
    monthlyRecurringOriginalAmount?: string | number | null;
    monthlyRecurringCurrency?: string | null;
    monthlyRecurringExchangeRate?: string | number | null;
    monthlyRecurringAmountUsd?: string | number | null;
    client?: { id: string };
    _count?: { incomes: number; expenses: number };
  };
  title: string;
  clients: ClientOption[];
}) {
  const [form, setForm] = useState({
    clientId: initial?.clientId ?? initial?.client?.id ?? "",
    name: initial?.name ?? "",
    isActive: initial?.isActive ?? true,
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    notes: initial?.notes ?? "",
    useOneTime: initial?.oneTimeAmountUsd != null || initial?.oneTimeOriginalAmount != null,
    oneTimeAmount: initial?.oneTimeOriginalAmount?.toString() ?? "",
    oneTimeCurrency: initial?.oneTimeCurrency ?? "USD",
    oneTimeExchangeRate: initial?.oneTimeExchangeRate?.toString() ?? "",
    useMonthly: initial?.monthlyRecurringAmountUsd != null || initial?.monthlyRecurringOriginalAmount != null,
    monthlyAmount: initial?.monthlyRecurringOriginalAmount?.toString() ?? "",
    monthlyCurrency: initial?.monthlyRecurringCurrency ?? "USD",
    monthlyExchangeRate: initial?.monthlyRecurringExchangeRate?.toString() ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hasMovements = (initial?._count?.incomes ?? 0) > 0 || (initial?._count?.expenses ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    setForm({
      clientId: initial?.clientId ?? initial?.client?.id ?? "",
      name: initial?.name ?? "",
      isActive: initial?.isActive ?? true,
      startDate: initial?.startDate ?? "",
      endDate: initial?.endDate ?? "",
      notes: initial?.notes ?? "",
      useOneTime: initial?.oneTimeAmountUsd != null || initial?.oneTimeOriginalAmount != null,
      oneTimeAmount: initial?.oneTimeOriginalAmount?.toString() ?? "",
      oneTimeCurrency: initial?.oneTimeCurrency ?? "USD",
      oneTimeExchangeRate: initial?.oneTimeExchangeRate?.toString() ?? "",
      useMonthly: initial?.monthlyRecurringAmountUsd != null || initial?.monthlyRecurringOriginalAmount != null,
      monthlyAmount: initial?.monthlyRecurringOriginalAmount?.toString() ?? "",
      monthlyCurrency: initial?.monthlyRecurringCurrency ?? "USD",
      monthlyExchangeRate: initial?.monthlyRecurringExchangeRate?.toString() ?? "",
    });
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        clientId: form.clientId,
        name: form.name,
        isActive: form.isActive,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes || null,
      };
      if (form.useOneTime) {
        payload.oneTimeOriginalAmount = Number(form.oneTimeAmount);
        payload.oneTimeCurrency = form.oneTimeCurrency;
        payload.oneTimeExchangeRate = form.oneTimeCurrency === "ARS" ? Number(form.oneTimeExchangeRate) : null;
      }
      if (form.useMonthly) {
        payload.monthlyRecurringOriginalAmount = Number(form.monthlyAmount);
        payload.monthlyRecurringCurrency = form.monthlyCurrency;
        payload.monthlyRecurringExchangeRate = form.monthlyCurrency === "ARS" ? Number(form.monthlyExchangeRate) : null;
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[90] overflow-y-auto px-4 py-6">
        <button aria-label="Cerrar" className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} type="button" />
        <div className="relative flex min-h-full items-start justify-center sm:items-center">
          <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_24px_80px_rgba(16,21,34,0.18)] overflow-x-hidden">
            <h2 className="font-display text-2xl text-ink">{title}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <Select
                value={form.clientId}
                onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
                required
                disabled={!!initial && hasMovements}
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {hasMovements && (
                <p className="text-xs text-ink/50">
                  El cliente no puede modificarse porque el proyecto tiene movimientos asociados.
                </p>
              )}
              <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              <Input type="date" placeholder="Fecha de inicio" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              <Input type="date" placeholder="Fecha de fin" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
              <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.useOneTime} onChange={(e) => setForm((p) => ({ ...p, useOneTime: e.target.checked }))} />
                Importe unico acordado
              </label>
              {form.useOneTime && (
                <div className="space-y-2 pl-4 border-l-2 border-cobalt/20">
                  <Input placeholder="Importe" type="number" step="any" value={form.oneTimeAmount} onChange={(e) => setForm((p) => ({ ...p, oneTimeAmount: e.target.value }))} required />
                  <Select value={form.oneTimeCurrency} onChange={(e) => setForm((p) => ({ ...p, oneTimeCurrency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </Select>
                  {form.oneTimeCurrency === "ARS" && (
                    <Input placeholder="Tipo de cambio" type="number" step="any" value={form.oneTimeExchangeRate} onChange={(e) => setForm((p) => ({ ...p, oneTimeExchangeRate: e.target.value }))} required />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.useMonthly} onChange={(e) => setForm((p) => ({ ...p, useMonthly: e.target.checked }))} />
                Importe mensual informativo
              </label>
              {form.useMonthly && (
                <div className="space-y-2 pl-4 border-l-2 border-cobalt/20">
                  <Input placeholder="Importe mensual" type="number" step="any" value={form.monthlyAmount} onChange={(e) => setForm((p) => ({ ...p, monthlyAmount: e.target.value }))} required />
                  <Select value={form.monthlyCurrency} onChange={(e) => setForm((p) => ({ ...p, monthlyCurrency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </Select>
                  {form.monthlyCurrency === "ARS" && (
                    <Input placeholder="Tipo de cambio" type="number" step="any" value={form.monthlyExchangeRate} onChange={(e) => setForm((p) => ({ ...p, monthlyExchangeRate: e.target.value }))} required />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Proyecto activo
              </label>

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
