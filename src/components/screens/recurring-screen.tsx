"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectRecord, RecurringContractRecord, ScheduledPaymentRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function RecurringScreen({
  contracts,
  payments,
  projects,
  demoMode,
}: {
  contracts: RecurringContractRecord[];
  payments: ScheduledPaymentRecord[];
  projects: ProjectRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    description: "",
    amountUsd: "",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/recurring", {
          method: "POST",
          body: JSON.stringify({
            projectId: form.projectId,
            description: form.description,
            amountUsd: Number(form.amountUsd),
            frequency: form.frequency,
            startDate: form.startDate,
            endDate: form.endDate || null,
            notes: form.notes || null,
          }),
        });
        setForm((prev) => ({ ...prev, description: "", amountUsd: "", endDate: "", notes: "" }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el contrato.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recurrentes"
        title="Contratos como plantilla, pagos programados como verdad operativa"
        description="Cada contrato genera un horizonte de cobros. Los estados viven en `scheduled_payments`, no en el contrato."
        demoMode={demoMode}
      />
      <div className="grid gap-6 xl:grid-cols-[0.84fr,1.16fr]">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <h2 className="font-display text-2xl text-ink">Nuevo contrato recurrente</h2>
            <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Descripción" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                min="0"
                placeholder="Monto USD"
                value={form.amountUsd}
                onChange={(event) => setForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
              />
              <Select value={form.frequency} onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value }))}>
                <option value="monthly">monthly</option>
                <option value="quarterly">quarterly</option>
                <option value="biannual">biannual</option>
                <option value="annual">annual</option>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              <Input type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} />
            </div>
            <Textarea placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear contrato"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-2xl text-ink">Contratos activos</h2>
            <div className="mt-4 space-y-4">
              {contracts.map((contract) => (
                <div key={contract.id} className="rounded-[1.35rem] border border-black/10 bg-white/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-ink/45">{contract.clientName}</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{contract.description}</div>
                      <p className="mt-2 text-sm text-ink/55">{contract.projectName}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl text-ink">{formatUsd(contract.amountUsd)}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-ink/45">{contract.frequency}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm text-ink/60">
                    <span>Inicio: {formatShortDate(contract.startDate)}</span>
                    <span>Próximo: {formatShortDate(contract.nextDueDate)}</span>
                    <span>{contract.isActive ? "Activo" : "Pausado"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-2xl text-ink">Próximos cobros</h2>
            <div className="mt-4">
              <DataTable headers={["Fecha", "Cliente", "Proyecto", "Monto", "Estado"]}>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatShortDate(payment.expectedDate)}</td>
                    <td className="px-4 py-3">{payment.clientName}</td>
                    <td className="px-4 py-3">{payment.projectName}</td>
                    <td className="px-4 py-3">{formatUsd(payment.expectedAmountUsd)}</td>
                    <td className="px-4 py-3 uppercase">{payment.status}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
