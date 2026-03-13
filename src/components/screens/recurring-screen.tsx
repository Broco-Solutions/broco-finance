"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectRecord, RecurringContractRecord, ScheduledPaymentRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatShortDate, formatUsd } from "@/lib/utils";
import { MarkPaymentPaidButton } from "@/components/payments/mark-payment-paid-button";
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
  const [contractError, setContractError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    description: "",
    amountUsd: "",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });
  const [contractDrafts, setContractDrafts] = useState<Record<string, { amountUsd: string; isActive: boolean }>>(() =>
    Object.fromEntries(
      contracts.map((contract) => [
        contract.id,
        {
          amountUsd: String(contract.amountUsd),
          isActive: contract.isActive,
        },
      ]),
    ),
  );

  useEffect(() => {
    setContractDrafts(
      Object.fromEntries(
        contracts.map((contract) => [
          contract.id,
          {
            amountUsd: String(contract.amountUsd),
            isActive: contract.isActive,
          },
        ]),
      ),
    );
  }, [contracts]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        setBusyTarget("new");
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
      } finally {
        setBusyTarget(null);
      }
    });
  };

  const saveContract = (contract: RecurringContractRecord) => {
    const draft = contractDrafts[contract.id];
    if (!draft) {
      return;
    }

    startTransition(async () => {
      try {
        setContractError(null);
        setBusyTarget(contract.id);
        await apiFetch(`/api/recurring/${contract.id}`, {
          method: "PUT",
          body: JSON.stringify({
            projectId: contract.projectId,
            description: contract.description,
            amountUsd: Number(draft.amountUsd),
            frequency: contract.frequency,
            startDate: contract.startDate,
            endDate: contract.endDate,
            isActive: draft.isActive,
            notes: contract.notes,
            updatePendingPayments: true,
          }),
        });
        router.refresh();
      } catch (submitError) {
        setContractError(submitError instanceof Error ? submitError.message : "No se pudo actualizar el contrato.");
      } finally {
        setBusyTarget(null);
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
              {demoMode ? "Requiere DATABASE_URL" : isPending && busyTarget === "new" ? "Guardando…" : "Crear contrato"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-ink">Contratos recurrentes</h2>
                <p className="mt-1 text-sm text-ink/55">Editar el monto impacta solo en pagos pendientes con fecha de hoy en adelante.</p>
              </div>
              {contractError ? <p className="text-sm text-brick">{contractError}</p> : null}
            </div>
            <div className="mt-4 space-y-4">
              {contracts.map((contract) => {
                const draft = contractDrafts[contract.id] ?? {
                  amountUsd: String(contract.amountUsd),
                  isActive: contract.isActive,
                };

                return (
                  <div key={contract.id} className="rounded-[1.35rem] border border-black/10 bg-white/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-ink/45">{contract.clientName}</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{contract.description}</div>
                      <p className="mt-2 text-sm text-ink/55">{contract.projectName}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl text-ink">{formatUsd(Number(draft.amountUsd || 0))}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-ink/45">{contract.frequency}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm text-ink/60">
                    <span>Inicio: {formatShortDate(contract.startDate)}</span>
                    <span>Próximo: {formatShortDate(contract.nextDueDate)}</span>
                    <span>{draft.isActive ? "Activo" : "Inactivo"}</span>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-[1.1rem] border border-black/10 bg-white/80 p-4 md:grid-cols-[minmax(0,220px),auto,auto] md:items-center">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Monto USD"
                      value={draft.amountUsd}
                      onChange={(event) =>
                        setContractDrafts((prev) => ({
                          ...prev,
                          [contract.id]: {
                            ...draft,
                            amountUsd: event.target.value,
                          },
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant={draft.isActive ? "secondary" : "ghost"}
                      onClick={() =>
                        setContractDrafts((prev) => ({
                          ...prev,
                          [contract.id]: {
                            ...draft,
                            isActive: !draft.isActive,
                          },
                        }))
                      }
                    >
                      {draft.isActive ? "Activo" : "Inactivo"}
                    </Button>
                    <Button type="button" disabled={isPending || demoMode} onClick={() => saveContract(contract)}>
                      {demoMode ? "Demo" : isPending && busyTarget === contract.id ? "Actualizando…" : "Guardar cambios"}
                    </Button>
                  </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-2xl text-ink">Próximos cobros</h2>
            <div className="mt-4">
              <DataTable headers={["Fecha", "Cliente", "Proyecto", "Monto", "Estado", "Acción"]}>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatShortDate(payment.expectedDate)}</td>
                    <td className="px-4 py-3">{payment.clientName}</td>
                    <td className="px-4 py-3">{payment.projectName}</td>
                    <td className="px-4 py-3">{formatUsd(payment.expectedAmountUsd)}</td>
                    <td className="px-4 py-3 uppercase">{payment.status}</td>
                    <td className="px-4 py-3">
                      <MarkPaymentPaidButton paymentId={payment.id} paymentStatus={payment.status} demoMode={demoMode} compact />
                    </td>
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
