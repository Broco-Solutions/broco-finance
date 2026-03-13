"use client";

import Link from "next/link";
import { FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";
import type { ClientRecord } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

export function ClientsScreen({
  clients,
  demoMode,
}: {
  clients: ClientRecord[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      clients.filter((client) => client.name.toLowerCase().includes(deferredQuery.toLowerCase())),
    [clients, deferredQuery],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/clients", {
          method: "POST",
          body: JSON.stringify({ name: form.name, notes: form.notes || null }),
        });
        setForm({ name: "", notes: "" });
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo crear el cliente.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clientes"
        title="Relación comercial y cuentas por cobrar"
        description="Cada cliente agrupa proyectos, facturación efectiva y deuda pendiente. El filtro es local para mantener la interfaz rápida."
        demoMode={demoMode}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-display text-2xl text-ink">Nuevo cliente</h2>
              <p className="mt-1 text-sm text-ink/55">Alta rápida para empezar a asociar proyectos e ingresos.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Nombre</label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Notas</label>
              <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Crear cliente"}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Base de clientes</h2>
              <p className="mt-1 text-sm text-ink/55">Buscador con `useDeferredValue` para no recalcular la tabla en cada tecla.</p>
            </div>
            <div className="w-full max-w-sm">
              <Input placeholder="Buscar cliente…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="Sin clientes" description="Cuando cargues clientes, vas a ver facturación, cuentas por cobrar y proyectos activos." />
          ) : (
            <DataTable headers={["Cliente", "Facturado", "Por cobrar", "Proyectos", "Detalle"]}>
              {filtered.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{client.name}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-ink/45">{client.notes ?? "Sin notas"}</div>
                  </td>
                  <td className="px-4 py-3">{formatUsd(client.totalInvoicedUsd)}</td>
                  <td className="px-4 py-3">{formatUsd(client.totalReceivableUsd)}</td>
                  <td className="px-4 py-3">{client.activeProjects}/{client.totalProjects}</td>
                  <td className="px-4 py-3">
                    <Link className="font-semibold text-cobalt" href={`/clients/${client.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
