"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DistributionPagePayload } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { formatMonthLabel, formatShortDate, formatUsd, toCurrencyNumber, toFixedCurrencyInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";

export function DistributionScreen({
  data,
  demoMode,
}: {
  data: DistributionPagePayload;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [layers, setLayers] = useState(
    data.layers.map((layer) => ({
      ...layer,
      currentAmountUsd: toFixedCurrencyInput(layer.currentAmountUsd),
      storageLocation: layer.storageLocation ?? "",
    })),
  );
  const [salary, setSalary] = useState({
    personName: "",
    month: new Date().toISOString().slice(0, 8) + "01",
    date: new Date().toISOString().slice(0, 10),
    amountUsd: "",
    notes: "",
  });
  const [historyQuery, setHistoryQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const projectedRemanente = useMemo(() => {
    const layersUsd = layers.reduce((sum, item) => sum + (toCurrencyNumber(item.currentAmountUsd) ?? 0), 0);
    return (toCurrencyNumber(data.summary.netResultUsd) ?? 0) - layersUsd;
  }, [data.summary.netResultUsd, layers]);

  const emergencyLayerUsd = useMemo(
    () => toCurrencyNumber(layers.find((layer) => layer.layer === "emergency")?.currentAmountUsd) ?? 0,
    [layers],
  );
  const growthLayerUsd = useMemo(
    () => toCurrencyNumber(layers.find((layer) => layer.layer === "growth")?.currentAmountUsd) ?? 0,
    [layers],
  );
  const realAvailableRemanente = useMemo(
    () => (toCurrencyNumber(data.summary.netResultUsd) ?? 0) - emergencyLayerUsd - growthLayerUsd,
    [data.summary.netResultUsd, emergencyLayerUsd, growthLayerUsd],
  );
  const visibleSalaries = useMemo(
    () =>
      data.salaries.filter((item) => {
        const query = historyQuery.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return (
          item.personName.toLowerCase().includes(query) ||
          (item.notes ?? "").toLowerCase().includes(query)
        );
      }),
    [data.salaries, historyQuery],
  );
  const filteredSalaryTotal = useMemo(
    () => visibleSalaries.reduce((sum, item) => sum + (toCurrencyNumber(item.amountUsd) ?? 0), 0),
    [visibleSalaries],
  );

  const saveLayers = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/distribution", {
          method: "PUT",
          body: JSON.stringify({
            layers: layers.map((layer) => ({
              layer: layer.layer,
              currentAmountUsd: toCurrencyNumber(layer.currentAmountUsd) ?? 0,
              storageLocation: layer.storageLocation || null,
            })),
          }),
        });
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo actualizar la distribución.");
      }
    });
  };

  const createSalary = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/salary", {
          method: "POST",
          body: JSON.stringify({
            personName: salary.personName,
            month: salary.month,
            date: salary.date,
            amountUsd: toCurrencyNumber(salary.amountUsd) ?? 0,
            notes: salary.notes || null,
          }),
        });
        setSalary((prev) => ({ ...prev, personName: "", amountUsd: "", notes: "" }));
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el retiro.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Distribución"
        title="Remanente histórico, capas activas y retiros"
        description="El remanente baja al modificar capas o registrar salarios porque los retiros crean gastos asociados. Nunca se descuenta dos veces."
        demoMode={demoMode}
      />

      <Card className="bg-gradient-to-br from-ink via-slate-950 to-cobalt text-white">
        <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/72">Remanente disponible</div>
            <div className="mt-3 font-display text-6xl leading-none text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] md:text-7xl">
              {formatUsd(toCurrencyNumber(projectedRemanente))}
            </div>
            <div className="mt-6 space-y-2 text-sm text-white/88">
              <div>Ingresos cobrados acumulados: {formatUsd(toCurrencyNumber(data.summary.totalIncomeUsd))}</div>
              <div>Egresos acumulados: {formatUsd(toCurrencyNumber(data.summary.totalExpenseUsd))}</div>
              <div>Resultado neto: {formatUsd(toCurrencyNumber(data.summary.netResultUsd))}</div>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">Después de capas</div>
            <div className="mt-3 space-y-3">
              {layers.map((layer) => (
                <div key={layer.id} className="flex items-center justify-between text-sm text-white/92">
                  <span className="font-medium capitalize">{layer.layer}</span>
                  <span className="font-semibold">{formatUsd(toCurrencyNumber(layer.currentAmountUsd))}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.35rem] border border-lime-300/35 bg-lime-100/10 p-4 shadow-[0_18px_40px_rgba(190,242,100,0.12)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-100">Remanente Real Disponible</div>
              <div className="mt-3 font-display text-4xl text-white">{formatUsd(toCurrencyNumber(realAvailableRemanente))}</div>
              <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/68">Resultado Neto - Capa Emergencia - Capa Growth</div>
              <div className="mt-3 space-y-2 text-sm text-white/88">
                <div className="flex items-center justify-between gap-4">
                  <span>Resultado Neto</span>
                  <span className="font-semibold">{formatUsd(toCurrencyNumber(data.summary.netResultUsd))}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Capa Emergencia</span>
                  <span className="font-semibold">{formatUsd(toCurrencyNumber(emergencyLayerUsd))}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Capa Growth</span>
                  <span className="font-semibold">{formatUsd(toCurrencyNumber(growthLayerUsd))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <form className="space-y-4" onSubmit={saveLayers}>
            <h2 className="font-display text-2xl text-ink">Capas de distribución</h2>
            {layers.map((layer, index) => (
              <div key={layer.id} className="grid gap-3 rounded-[1.2rem] border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{layer.layer}</div>
                <Input
                  type="number"
                  min="0"
                  value={layer.currentAmountUsd}
                  onChange={(event) =>
                    setLayers((prev) => prev.map((item, current) => (current === index ? { ...item, currentAmountUsd: event.target.value } : item)))
                  }
                />
                <Input
                  value={layer.storageLocation}
                  onChange={(event) =>
                    setLayers((prev) => prev.map((item, current) => (current === index ? { ...item, storageLocation: event.target.value } : item)))
                  }
                  placeholder="Ubicación"
                />
              </div>
            ))}
            {error ? <p className="text-sm text-brick">{error}</p> : null}
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Guardar capas"}
            </Button>
          </form>
        </Card>

        <Card>
          <form className="space-y-4" onSubmit={createSalary}>
            <div>
              <h2 className="font-display text-2xl text-ink">Registrar retiro</h2>
              <p className="mt-1 text-sm text-ink/55">Mes contable y fecha de caja se guardan por separado.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Persona" value={salary.personName} onChange={(event) => setSalary((prev) => ({ ...prev, personName: event.target.value }))} />
              <Input
                type="number"
                min="0"
                placeholder="Monto USD"
                value={salary.amountUsd}
                onChange={(event) => setSalary((prev) => ({ ...prev, amountUsd: event.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={salary.month} onChange={(event) => setSalary((prev) => ({ ...prev, month: event.target.value }))} />
              <Input type="date" value={salary.date} onChange={(event) => setSalary((prev) => ({ ...prev, date: event.target.value }))} />
            </div>
            <Textarea placeholder="Notas" value={salary.notes} onChange={(event) => setSalary((prev) => ({ ...prev, notes: event.target.value }))} />
            <Button type="submit" disabled={isPending || demoMode}>
              {demoMode ? "Requiere DATABASE_URL" : isPending ? "Guardando…" : "Registrar retiro"}
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-xl text-ink">Historial de distribución</h3>
                <p className="mt-1 text-sm text-ink/55">Filtrá por persona o nota para leer retiros del mes operativo visible.</p>
              </div>
              <Input
                className="max-w-sm"
                placeholder="Filtrar por persona o nota…"
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
              />
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-cobalt/10 bg-[linear-gradient(90deg,rgba(239,246,255,0.92),rgba(248,250,252,0.96))] px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt">Total filtrado</div>
                <div className="mt-1 text-sm text-ink/60">{visibleSalaries.length} retiros visibles</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">USD</div>
                <div className="mt-1 font-display text-2xl text-cobalt">{formatUsd(filteredSalaryTotal)}</div>
              </div>
            </div>
            <DataTable
              headers={["Persona", "Mes", "Fecha", "USD", "Notas"]}
              footer={
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink" colSpan={3}>
                    Total filtrado
                  </td>
                  <td className="px-4 py-3 font-semibold text-cobalt">{formatUsd(filteredSalaryTotal)}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink/45">{visibleSalaries.length} filas</td>
                </tr>
              }
            >
              {visibleSalaries.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold text-ink">{item.personName}</td>
                  <td className="px-4 py-3">{formatMonthLabel(item.month)}</td>
                  <td className="px-4 py-3">{formatShortDate(item.date)}</td>
                  <td className="px-4 py-3">{formatUsd(toCurrencyNumber(item.amountUsd))}</td>
                  <td className="px-4 py-3 text-ink/60">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>
    </div>
  );
}
