"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IncomeRecord, ProjectRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatArs, formatShortDate, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function IncomesScreen({
  incomes,
  projects,
  demoMode,
}: {
  incomes: IncomeRecord[];
  projects: ProjectRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    type: "advance",
    amountUsd: "",
    amountArs: "",
    exchangeRate: "",
    notes: "",
  });

  const visibleIncomes = useMemo(
    () => (typeFilter ? incomes.filter((income) => income.type === typeFilter) : incomes),
    [incomes, typeFilter],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/incomes", {
          method: "POST",
          body: JSON.stringify({
            projectId: form.projectId,
            date: form.date,
            type: form.type,
            amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
            amountArs: form.amountArs ? Number(form.amountArs) : null,
            exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
            notes: form.notes || null,
          }),
        });
        setForm((prev) => ({ ...prev, amountUsd: "", amountArs: "", exchangeRate: "", notes: "" }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el ingreso.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ingresos"
        title="Cobros efectivos en USD como valor canónico"
        description="Podés registrar directo en USD o capturar ARS + tipo de cambio manual. El sistema normaliza `amount_usd` para todos los cálculos."
        demoMode={demoMode}
      />
      <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <h2 className="font-display text-2xl text-ink">Nuevo ingreso</h2>
            <Select value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </Select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
              <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
                <option value="advance">advance</option>
                <option value="final_payment">final_payment</option>
                <option value="recurring">recurring</option>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="number"
                min="0"
                placeholder="Monto USD"
                value={form.amountUsd}
                onChange={(event) => setForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
              />
              <Input
                type="number"
                min="0"
                placeholder="Monto ARS"
                value={form.amountArs}
                onChange={(event) => setForm((prev) => ({ ...prev, amountArs: event.target.value }))}
              />
              <Input
                type="number"
                min="0"
                placeholder="TC"
                value={form.exchangeRate}
                onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
              />
            </div>
            <Textarea placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Registrar ingreso"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Historial</h2>
              <p className="mt-1 text-sm text-ink/55">Todos los totales que ves en dashboard y remanente salen de esta tabla.</p>
            </div>
            <Select className="max-w-[220px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="advance">advance</option>
              <option value="final_payment">final_payment</option>
              <option value="recurring">recurring</option>
            </Select>
          </div>
          <DataTable headers={["Fecha", "Cliente", "Proyecto", "ARS", "USD", "Tipo", "Notas"]}>
            {visibleIncomes.map((income) => (
              <tr key={income.id}>
                <td className="px-4 py-3">{formatShortDate(income.date)}</td>
                <td className="px-4 py-3">{income.clientName}</td>
                <td className="px-4 py-3">{income.projectName}</td>
                <td className="px-4 py-3">{formatArs(income.amountArs)}</td>
                <td className="px-4 py-3">{formatUsd(income.amountUsd)}</td>
                <td className="px-4 py-3 uppercase">{income.type}</td>
                <td className="px-4 py-3 text-ink/60">{income.notes ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
