"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";

type Evolution = Awaited<ReturnType<typeof import("@/server/services/dashboard").getFinancialEvolution>>;

export function FinancialEvolution({ evolution }: { evolution: Evolution }) {
  const router = useRouter();
  const [range, setRange] = useState<"6m" | "12m" | "year">("12m");

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Evolución financiera</h3>
          {(() => {
            const r = evolution.ranges[range] ?? evolution.ranges["12m"];
            return <p className="text-xs text-gray-400 mt-0.5">Meses cerrados · {r.rangeLabel || "—"}</p>;
          })()}
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
          {[
            { k: "6m", l: "6 meses" },
            { k: "12m", l: "12 meses" },
            { k: "year", l: "Año actual" },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setRange(o.k as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${range === o.k ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {(() => {
        const r = evolution.ranges[range] as {
          months: Array<{
            year: number;
            month: number;
            label: string;
            fromISO: string;
            toISO: string;
            incomesUsd: number;
            expensesUsd: number;
            netUsd: number;
            trendNetUsd?: number;
            prevIncomesUsd?: number;
            prevExpensesUsd?: number;
            prevNetUsd?: number;
          }>;
          kpis: { totalIncomes: number; totalExpenses: number; net: number; avgNet: number };
          trend: { slope: number; classification: string; threshold: number; activeMonths: number };
          phrase: string;
        };
        if (!r || r.months.length === 0) {
          return <p className="text-xs text-gray-400 py-6 text-center">Sin meses cerrados en el año actual.</p>;
        }
        const activeMonths = (r.trend as any).activeMonths ?? r.months.filter((m) => m.incomesUsd !== 0 || m.expensesUsd !== 0).length;
        const hasSufficientTrendData = r.months.length >= 3 && activeMonths >= 3;
        const isInsufficient = !hasSufficientTrendData;
        const showTrendLine = hasSufficientTrendData;
        const isEmpty = activeMonths === 0;
        const trendLabel =
          r.trend.classification === "Datos insuficientes"
            ? "Datos insuficientes"
            : r.trend.classification === "Estable"
              ? "→ Estable"
              : r.trend.slope > 0
                ? `↑ +${formatUsd(Math.abs(Math.round(r.trend.slope)))} / mes`
                : `↓ -${formatUsd(Math.abs(Math.round(r.trend.slope)))} / mes`;
        const trendTone =
          r.trend.classification === "Favorable" ? "text-emerald-600" : r.trend.classification === "Desfavorable" ? "text-red-600" : "text-gray-500";
        const insufficientSubtext =
          r.months.length < 3
            ? "Se requieren 3 meses"
            : `${activeMonths} de ${r.months.length} ${activeMonths === 1 ? "mes tiene" : "meses tienen"} movimientos`;

        return (
          <>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wider">Ingresos cobrados</div>
                <div className="text-lg font-bold tabular-nums text-gray-900">{formatUsd(r.kpis.totalIncomes)}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wider">Gastos pagados</div>
                <div className="text-lg font-bold tabular-nums text-gray-900">{formatUsd(r.kpis.totalExpenses)}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wider">Resultado neto</div>
                <div className={`text-lg font-bold tabular-nums ${r.kpis.net >= 0 ? "text-gray-900" : "text-red-600"}`}>{formatUsd(r.kpis.net)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Promedio: {formatUsd(Math.round(r.kpis.avgNet))} / mes</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wider">Tendencia mensual</div>
                <div className={`text-sm font-bold tabular-nums mt-1 ${isInsufficient ? "text-gray-500" : trendTone}`}>{isInsufficient ? "Datos insuficientes" : trendLabel}</div>
                <div className="text-xs text-gray-400 mt-0.5">{isInsufficient ? insufficientSubtext : r.trend.classification}</div>
              </div>
            </div>

            {isEmpty ? (
              <div className="flex h-[140px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-400 text-center px-4">Sin movimientos cobrados o pagados en el período seleccionado.</p>
              </div>
            ) : (
              <>
                <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={r.months}
                    margin={{ top: 20, right: 5, left: 10, bottom: 5 }}
                    onClick={(data: any) => {
                      const payload = data?.activePayload?.[0]?.payload;
                      if (payload?.fromISO && payload?.toISO) {
                        if (payload.incomesUsd > 0) {
                          window.location.href = `/incomes?status=PAID&from=${payload.fromISO}&to=${payload.toISO}`;
                        } else if (payload.expensesUsd > 0) {
                          window.location.href = `/expenses?status=PAID&from=${payload.fromISO}&to=${payload.toISO}`;
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      const prevInc = d.prevIncomesUsd;
                      const prevExp = d.prevExpensesUsd;
                      const pctInc = prevInc != null && prevInc !== 0 ? ((d.incomesUsd - prevInc) / Math.abs(prevInc)) * 100 : null;
                      const pctExp = prevExp != null && prevExp !== 0 ? ((d.expensesUsd - prevExp) / Math.abs(prevExp)) * 100 : null;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs">
                          <div className="font-semibold text-gray-700 mb-1">{label}</div>
                          <div className="space-y-1">
                            <div>
                              <div className="text-gray-500">Ingresos</div>
                              <div className="font-medium">{formatUsd(d.incomesUsd)}</div>
                              {pctInc != null ? (
                                <div className={pctInc >= 0 ? "text-emerald-600" : "text-red-600"}>{pctInc >= 0 ? "↑" : "↓"} {Math.abs(pctInc).toFixed(1)}% vs anterior</div>
                              ) : (
                                d.prevIncomesUsd != null && <div className="text-gray-400">Sin base comparable</div>
                              )}
                            </div>
                            <div>
                              <div className="text-gray-500">Gastos</div>
                              <div className="font-medium">{formatUsd(d.expensesUsd)}</div>
                              {pctExp != null ? (
                                <div className={pctExp >= 0 ? "text-red-600" : "text-emerald-600"}>{pctExp >= 0 ? "↑" : "↓"} {Math.abs(pctExp).toFixed(1)}% vs anterior</div>
                              ) : (
                                d.prevExpensesUsd != null && <div className="text-gray-400">Sin base comparable</div>
                              )}
                            </div>
                            <div>
                              <div className="text-gray-500">Resultado</div>
                              <div className="font-medium">{formatUsd(d.netUsd)}</div>
                              {d.prevNetUsd != null && <div className="text-gray-400">vs {formatUsd(d.prevNetUsd)} anterior</div>}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                    <Legend iconType="rect" iconSize={10} />
                  <Bar
                    dataKey="incomesUsd"
                    name="Ingresos"
                    fill="#10b981"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    onClick={(data: any) => {
                      const p = data?.payload ?? data;
                      if (p?.fromISO && p?.toISO) router.push(`/incomes?status=PAID&from=${p.fromISO}&to=${p.toISO}`);
                    }}
                    cursor="pointer"
                  />
                  <Bar
                    dataKey="expensesUsd"
                    name="Gastos"
                    fill="#ef4444"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    onClick={(data: any) => {
                      const p = data?.payload ?? data;
                      if (p?.fromISO && p?.toISO) router.push(`/expenses?status=PAID&from=${p.fromISO}&to=${p.toISO}`);
                    }}
                    cursor="pointer"
                  />
                  <Line type="linear" dataKey="netUsd" name="Neto" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                  {hasSufficientTrendData && (
                    <Line type="linear" dataKey="trendNetUsd" name="Tendencia" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Ingresos por tipo - stacked */}
            {(() => {
              const hasTypes = evolution.incomeTypes && evolution.incomeTypes.length > 0;
              if (!hasTypes) return null;
              const hasData = r.months.some((m: any) => m.incomesByType && Object.keys(m.incomesByType).length > 0);
              if (!hasData) return null;
              const palette: Record<string, string> = { Desarrollo: "#6366f1", Mantenimiento: "#0ea5e9" };
              return (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Ingresos por tipo</h4>
                  <div className="h-40 sm:h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={r.months} margin={{ top: 10, right: 5, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="shortLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const d = payload[0]?.payload;
                            if (!d) return null;
                            return (
                              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs">
                                <div className="font-semibold text-gray-700 mb-1">{label}</div>
                                {evolution.incomeTypes.map((t: any) => {
                                  const val = d.incomesByType?.[t.id] ?? 0;
                                  if (val === 0) return null;
                                  return (
                                    <div key={t.id} className="flex justify-between gap-4">
                                      <span style={{ color: palette[t.name] ?? "#6366f1" }}>{t.name}</span>
                                      <span className="font-medium">{formatUsd(val)}</span>
                                    </div>
                                  );
                                })}
                                <div className="border-t border-gray-100 mt-1 pt-1 flex justify-between font-semibold">
                                  <span>Total</span>
                                  <span>{formatUsd(d.incomesUsd)}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend iconType="rect" iconSize={10} />
                        {evolution.incomeTypes.map((t: any) => (
                          <Bar
                            key={t.id}
                            dataKey={(d: any) => d.incomesByType?.[t.id] ?? 0}
                            name={t.name}
                            stackId="ingresos"
                            fill={palette[t.name] ?? "#6366f1"}
                            radius={t.name === "Mantenimiento" ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                            maxBarSize={24}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            <p className="text-xs text-gray-500 mt-3 text-center px-2">{r.phrase}</p>
              </>
            )}
          </>
        );
      })()}
    </Card>
  );
}
