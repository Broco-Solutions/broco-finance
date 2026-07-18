"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, Plus, Minus, AlertTriangle } from "lucide-react";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatArs } from "@/lib/money";
import { formatDate, formatDateShort } from "@/lib/dates";

const COLORS = ["#3b82f6","#22c55e","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#ec4899","#14b8a6","#f97316","#6366f1"];

type Data = Awaited<ReturnType<typeof import("@/server/services/dashboard").getDashboard>>;

function pctChange(cur: number, prev: number): { text: string; positive: boolean; zero: boolean } | null {
  if (prev === 0 && cur === 0) return { text: "—", positive: true, zero: true };
  if (prev === 0) return null; // "Sin base comparable"
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(v)) return null;
  return { text: `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, positive: v >= 0, zero: false };
}

function KpiCard({ title, value, prevValue, invertGreen }: { title: string; value: number; prevValue?: number; invertGreen?: boolean }) {
  const change = prevValue != null ? pctChange(value, prevValue) : null;
  let trend: "up" | "down" | "neutral" = "neutral";
  if (change && !change.zero) trend = invertGreen ? (change.positive ? "down" : "up") : (change.positive ? "up" : "down");
  return (
    <div className="kpi-card flex flex-col gap-1">
      <div className="text-xs font-medium text-gray-500">{title}</div>
      <div className="kpi-value text-xl sm:text-2xl font-bold text-gray-900">{formatUsd(value)}</div>
      <div className="flex items-center gap-1.5 text-xs">
        {change === null && prevValue != null && prevValue === 0 && value !== 0 && <span className="text-gray-400">Sin base comparable</span>}
        {change && !change.zero && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${trend === "up" ? "text-positive" : "text-negative"}`}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change.text}
          </span>
        )}
        {change?.zero && <span className="text-gray-400">{change.text}</span>}
      </div>
    </div>
  );
}

export function DashboardClient({ data, prevData, periodLabel, period }: { data: Data; prevData: Data; periodLabel: string; period: string }) {
  const router = useRouter();
  const [preset, setPreset] = useState(period === "custom" ? "custom" : (period || "this-month"));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const k = data.kpis;

  const applyPreset = (p: string) => {
    setPreset(p);
    if (p === "custom") return;
    router.push(`/?period=${p}`);
  };
  const applyCustom = () => { if (from && to) router.push(`/?period=custom&from=${from}&to=${to}`); };

  const chartData = [{ name: "Ingresos", Ingresos: k.paidIncomesUsd, Gastos: k.paidExpensesUsd, Neto: k.netUsd }];

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {[{k:"this-month",l:"Este mes"},{k:"last-month",l:"Mes anterior"},{k:"this-year",l:"Este año"},{k:"custom",l:"Personalizado"}].map(o => (
            <button key={o.k} onClick={() => applyPreset(o.k)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${preset === o.k ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"}`}>{o.l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs h-8" />
            <span className="text-xs text-gray-400">a</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs h-8" />
            <Button variant="secondary" onClick={applyCustom} className="text-xs">Aplicar</Button>
          </div>
        )}
        <Badge tone="neutral">{periodLabel}</Badge>
        <div className="flex gap-2 ml-auto">
          <Link href="/incomes?new=1"><Button variant="secondary" className="text-xs"><Plus className="mr-1 h-3.5 w-3.5" />Nuevo ingreso</Button></Link>
          <Link href="/expenses?new=1"><Button variant="secondary" className="text-xs"><Minus className="mr-1 h-3.5 w-3.5" />Nuevo gasto</Button></Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Ingresos" value={k.paidIncomesUsd} prevValue={prevData.kpis.paidIncomesUsd} />
        <KpiCard title="Gastos" value={k.paidExpensesUsd} prevValue={prevData.kpis.paidExpensesUsd} invertGreen />
        <KpiCard title="Resultado neto" value={k.netUsd} prevValue={prevData.kpis.netUsd} />
        <KpiCard title="Pendiente de cobro" value={k.pendingIncomesUsd} prevValue={prevData.kpis.pendingIncomesUsd} />
        <KpiCard title="Pendiente de pago" value={k.pendingExpensesUsd} prevValue={prevData.kpis.pendingExpensesUsd} />
      </div>

      {/* Main chart */}
      <Card className="p-4">
        <h3 className="section-title mb-3">Ingresos y gastos</h3>
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `USD ${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatUsd(v)} />
              <Legend />
              <Bar dataKey="Ingresos" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Gastos" fill="#ef4444" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="Neto" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Vencimientos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="section-title mb-3">Vencidos</h3>
          <div className="space-y-1.5 text-sm">
            {k.overdueIncomesCount === 0 && k.overdueExpensesCount === 0 && <p className="text-xs text-gray-400 py-2">Sin vencidos.</p>}
            {k.overdueIncomesCount > 0 && (
              <Link href="/incomes" className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-2.5 text-red-700 hover:bg-red-100">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{k.overdueIncomesCount} ingresos</span>
                <span className="font-semibold tabular-nums">{formatUsd(k.overdueIncomesUsd)}</span>
              </Link>
            )}
            {k.overdueExpensesCount > 0 && (
              <Link href="/expenses" className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-2.5 text-red-700 hover:bg-red-100">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{k.overdueExpensesCount} gastos</span>
                <span className="font-semibold tabular-nums">{formatUsd(k.overdueExpensesUsd)}</span>
              </Link>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="section-title mb-3">Próximos 30 días</h3>
          <div className="space-y-1.5 text-sm">
            {data.upcomingIncomes.length === 0 && data.upcomingExpenses.length === 0 && <p className="text-xs text-gray-400 py-2">Sin próximos cobros ni pagos.</p>}
            {data.upcomingIncomes.slice(0,3).map(i => (
              <Link key={i.id} href="/incomes" className="flex items-center justify-between rounded-lg border border-gray-100 p-2 hover:bg-gray-50">
                <span className="text-gray-700 truncate text-xs">{i.concept}</span>
                <span className="text-xs text-gray-400 ml-2">{i.dueDate ? formatDateShort(i.dueDate) : "—"}</span>
                <span className="font-medium tabular-nums ml-2 text-xs">{formatUsd(i.amountUsd)}</span>
              </Link>
            ))}
            {data.upcomingExpenses.slice(0,3).map(e => (
              <Link key={e.id} href="/expenses" className="flex items-center justify-between rounded-lg border border-gray-100 p-2 hover:bg-gray-50">
                <span className="text-gray-700 truncate text-xs">{e.concept}</span>
                <span className="text-xs text-gray-400 ml-2">{e.dueDate ? formatDateShort(e.dueDate) : "—"}</span>
                <span className="font-medium tabular-nums ml-2 text-xs">{formatUsd(e.amountUsd)}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
