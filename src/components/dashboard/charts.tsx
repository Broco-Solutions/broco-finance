"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type ChartValue = number | string | ReadonlyArray<number | string> | undefined;

function formatChartCurrency(value: ChartValue) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return formatCurrency(typeof rawValue === "number" ? rawValue : Number(rawValue));
}

export function MonthlyPerformanceChart({
  data,
}: {
  data: Array<{ month: string; incomeUsd: number; expenseUsd: number; netUsd: number }>;
}) {
  return (
    <Card className="h-[360px]">
      <div className="mb-4">
        <h3 className="font-display text-2xl text-ink">Ingresos vs Egresos</h3>
        <p className="text-sm text-ink/55">Vista mensual del neto operativo.</p>
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,21,34,0.08)" />
          <XAxis dataKey="month" stroke="#5f6673" />
          <YAxis stroke="#5f6673" tickFormatter={formatChartCurrency} width={96} />
          <Tooltip formatter={formatChartCurrency} />
          <Bar dataKey="incomeUsd" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
          <Bar dataKey="expenseUsd" fill="#f97316" radius={[10, 10, 0, 0]} />
          <Area type="monotone" dataKey="netUsd" stroke="#101522" fill="rgba(16,21,34,0.08)" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function CategoryBreakdownChart({
  data,
}: {
  data: Array<{ category: string; amountUsd: number }>;
}) {
  return (
    <Card className="h-[360px]">
      <div className="mb-4">
        <h3 className="font-display text-2xl text-ink">Gastos por categoría</h3>
        <p className="text-sm text-ink/55">Fijos y variables consolidados.</p>
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amountUsd"
            nameKey="category"
            innerRadius={65}
            outerRadius={110}
            paddingAngle={4}
            fill="#1d4ed8"
          />
          <Tooltip formatter={formatChartCurrency} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function CashflowChart({
  data,
}: {
  data: Array<{ month: string; valueUsd: number }>;
}) {
  return (
    <Card className="h-[320px]">
      <div className="mb-4">
        <h3 className="font-display text-2xl text-ink">Cash flow acumulado</h3>
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,21,34,0.08)" />
          <XAxis dataKey="month" stroke="#5f6673" />
          <YAxis stroke="#5f6673" tickFormatter={formatChartCurrency} width={96} />
          <Tooltip formatter={formatChartCurrency} />
          <Area type="monotone" dataKey="valueUsd" stroke="#101522" fill="rgba(190, 242, 100, 0.45)" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
