"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, Minus, Plus, AlertTriangle } from "lucide-react";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { formatUsd, formatChange } from "@/lib/money";
import { formatDate } from "@/lib/dates";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

type Data = Awaited<ReturnType<typeof import("@/server/services/dashboard").getDashboard>>;

function KpiCard({ title, value, prevValue, detail }: { title: string; value: number; prevValue?: number; detail?: string }) {
  const change = prevValue != null ? formatChange(value, prevValue) : null;
  return (
    <div className="kpi-card flex flex-col gap-1">
      <div className="text-xs font-medium text-gray-500">{title}</div>
      <div className="kpi-value text-2xl font-bold text-gray-900">{formatUsd(value)}</div>
      <div className="flex items-center gap-2 text-xs">
        {detail && <span className="text-gray-400">{detail}</span>}
        {change && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${change.positive ? "text-positive" : "text-negative"}`}>
            {change.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change.text}
          </span>
        )}
      </div>
    </div>
  );
}

function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const m = sp.get("month") ?? String(new Date().getMonth() + 1);
  const y = sp.get("year") ?? String(new Date().getFullYear());

  if (value === "custom") return null;
  return (
    <div className="flex gap-2">
      <Select value={m} onChange={(e) => router.push(`/?month=${e.target.value}&year=${y}`)} className="w-28">
        {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((n,i) => <option key={i} value={i+1}>{n}</option>)}
      </Select>
      <Select value={y} onChange={(e) => router.push(`/?month=${m}&year=${e.target.value}`)} className="w-20">
        {[2024,2025,2026,2027].map(yy => <option key={yy} value={yy}>{yy}</option>)}
      </Select>
    </div>
  );
}

export function DashboardClient({ data, prevData }: { data: Data; prevData?: Data }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [preset, setPreset] = useState(sp.get("from") ? "custom" : (sp.get("month") ? "month" : "this-month"));
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const k = data.kpis;

  const applyPreset = (p: string) => {
    setPreset(p);
    if (p === "this-month") { const d = new Date(); router.push(`/?month=${d.getMonth()+1}&year=${d.getFullYear()}`); }
    else if (p === "last-month") { const d = new Date(); const m = d.getMonth() === 0 ? 12 : d.getMonth(); const y = d.getMonth() === 0 ? d.getFullYear()-1 : d.getFullYear(); router.push(`/?month=${m}&year=${y}`); }
    else if (p === "this-year") { router.push(`/?month=1&year=${new Date().getFullYear()}`); }
    else setPreset("custom");
  };

  const applyCustom = () => { if (from && to) router.push(`/?from=${from}&to=${to}`); };

  const chartData = [
    { name: "Ingresos", Ingresos: k.paidIncomesUsd, Gastos: k.paidExpensesUsd, Neto: k.netUsd },
  ];

  const catData = [
    { name: "Vencidos", value: k.overdueIncomesUsd + k.overdueExpensesUsd },
    { name: "Pendientes", value: k.pendingIncomesUsd + k.pendingExpensesUsd },
  ];

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {[{k:"this-month",l:"Este mes"},{k:"last-month",l:"Mes anterior"},{k:"this-year",l:"Este año"},{k:"custom",l:"Personalizado"}].map(o => (
            <button key={o.k} onClick={() => applyPreset(o.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${preset === o.k ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {o.l}
            </button>
          ))}
        </div>
        {preset !== "custom" && (preset === "month" || preset === "this-month" || preset === "last-month") && <MonthPicker value={preset} />}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs" />
            <span className="text-xs text-gray-400">a</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs" />
            <Button variant="secondary" onClick={applyCustom} className="text-xs">Aplicar</Button>
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <Link href="/incomes"><Button variant="secondary" className="text-xs"><Plus className="mr-1 h-3.5 w-3.5" /> Nuevo ingreso</Button></Link>
          <Link href="/expenses"><Button variant="secondary" className="text-xs"><Minus className="mr-1 h-3.5 w-3.5" /> Nuevo gasto</Button></Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Ingresos" value={k.paidIncomesUsd} prevValue={prevData?.kpis.paidIncomesUsd} detail={`${k.paidIncomesCount} mov.`} />
        <KpiCard title="Gastos" value={k.paidExpensesUsd} prevValue={prevData?.kpis.paidExpensesUsd} detail={`${k.paidExpensesCount} mov.`} />
        <KpiCard title="Resultado neto" value={k.netUsd} prevValue={prevData?.kpis.netUsd} />
        <KpiCard title="Pendiente de cobro" value={k.pendingIncomesUsd} />
        <KpiCard title="Pendiente de pago" value={k.pendingExpensesUsd} />
      </div>

      {/* Main chart */}
      <Card className="p-4">
        <h3 className="section-title mb-3">Ingresos y gastos</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `USD ${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatUsd(v)} />
              <Legend />
              <Bar dataKey="Ingresos" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Gastos" fill="#ef4444" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="Neto" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Secondary charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="section-title mb-3">Gastos por categoria</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" label={({name,value}) => `${name}`}>
                  {catData.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatUsd(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="section-title mb-3">Vencimientos</h3>
          <div className="space-y-2 text-sm">
            {k.overdueIncomesCount > 0 && (
              <Link href="/incomes" className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-2.5 text-red-700 hover:bg-red-100">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {k.overdueIncomesCount} ingresos vencidos</span>
                <span className="font-semibold tabular-nums">{formatUsd(k.overdueIncomesUsd)}</span>
              </Link>
            )}
            {k.overdueExpensesCount > 0 && (
              <Link href="/expenses" className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-2.5 text-red-700 hover:bg-red-100">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {k.overdueExpensesCount} gastos vencidos</span>
                <span className="font-semibold tabular-nums">{formatUsd(k.overdueExpensesUsd)}</span>
              </Link>
            )}
            {data.upcomingIncomes.slice(0, 3).map(i => (
              <Link key={i.id} href="/incomes" className="flex items-center justify-between rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50">
                <span className="text-gray-700 truncate">{i.concept}</span>
                <span className="text-xs text-gray-400 ml-2">{i.dueDate ? formatDate(i.dueDate) : "—"}</span>
                <span className="font-medium tabular-nums ml-2">{formatUsd(i.amountUsd)}</span>
              </Link>
            ))}
            {data.upcomingExpenses.slice(0, 3).map(e => (
              <Link key={e.id} href="/expenses" className="flex items-center justify-between rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50">
                <span className="text-gray-700 truncate">{e.concept}</span>
                <span className="text-xs text-gray-400 ml-2">{e.dueDate ? formatDate(e.dueDate) : "—"}</span>
                <span className="font-medium tabular-nums ml-2">{formatUsd(e.amountUsd)}</span>
              </Link>
            ))}
            {k.overdueIncomesCount === 0 && k.overdueExpensesCount === 0 && data.upcomingIncomes.length === 0 && data.upcomingExpenses.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">Sin vencimientos ni proximos cobros.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
