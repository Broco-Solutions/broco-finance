"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Data = {
  period: { month: number; year: number };
  kpis: { paidIncomesUsd: number; paidExpensesUsd: number; netUsd: number; paidIncomesCount: number; paidExpensesCount: number; pendingIncomesUsd: number; pendingExpensesUsd: number; overdueIncomesCount: number; overdueIncomesUsd: number; overdueExpensesCount: number; overdueExpensesUsd: number };
  upcomingIncomes: { id: string; concept: string; dueDate: string | null; amountUsd: number; clientName: string | null; projectName: string | null }[];
  upcomingExpenses: { id: string; concept: string; dueDate: string | null; amountUsd: number; categoryName: string; projectName: string | null }[];
  overdueIncomes: { id: string; concept: string; dueDate: string | null; amountUsd: number; clientName: string | null; projectName: string | null }[];
  overdueExpenses: { id: string; concept: string; dueDate: string | null; amountUsd: number; categoryName: string; projectName: string | null }[];
};

const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const thisYear = new Date().getFullYear();

export function DashboardContent({ data }: { data: Data }) {
  const router = useRouter();
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Select value={String(data.period.month)} onChange={(e) => { const m = e.target.value; router.push(`/?month=${m}&year=${data.period.year}`); }} className="w-36">
          {months.map((name, i) => <option key={i} value={i+1}>{name}</option>)}
        </Select>
        <Select value={String(data.period.year)} onChange={(e) => router.push(`/?month=${data.period.month}&year=${e.target.value}`)} className="w-24">
          {[thisYear-1, thisYear, thisYear+1].map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="text-xs uppercase tracking-widest text-ink/50">Ingresos cobrados</div><div className="mt-1 font-display text-3xl text-ink">USD {k.paidIncomesUsd.toFixed(2)}</div><div className="text-xs text-ink/40">{k.paidIncomesCount} movimientos</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-ink/50">Gastos pagados</div><div className="mt-1 font-display text-3xl text-ink">USD {k.paidExpensesUsd.toFixed(2)}</div><div className="text-xs text-ink/40">{k.paidExpensesCount} movimientos</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-ink/50">Resultado</div><div className={`mt-1 font-display text-3xl ${k.netUsd >= 0 ? "text-ink" : "text-brick"}`}>USD {k.netUsd.toFixed(2)}</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-ink/50">Pendientes</div><div className="mt-1 font-display text-3xl text-ink">USD {k.pendingIncomesUsd.toFixed(2)}</div><div className="text-xs text-ink/40">Ing +{k.pendingIncomesUsd.toFixed(2)} / Gas {k.pendingExpensesUsd.toFixed(2)}</div></Card>
      </div>

      {/* Alerts */}
      {(k.overdueIncomesCount > 0 || k.overdueExpensesCount > 0) && (
        <Card className="border-brick/30 bg-brick/5">
          <h3 className="font-display text-lg text-brick">Vencidos</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {k.overdueIncomesCount > 0 && <Link href="/incomes" className="text-brick underline">{k.overdueIncomesCount} ingresos vencidos (USD {k.overdueIncomesUsd.toFixed(2)})</Link>}
            {k.overdueExpensesCount > 0 && <Link href="/expenses" className="text-brick underline">{k.overdueExpensesCount} gastos vencidos (USD {k.overdueExpensesUsd.toFixed(2)})</Link>}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-display text-lg text-ink">Proximos ingresos (7 dias)</h3>
          <div className="mt-3 space-y-2">
            {data.upcomingIncomes.length === 0 && <p className="text-sm text-ink/40">Sin ingresos proximos.</p>}
            {data.upcomingIncomes.map((i) => (
              <div key={i.id} className="flex justify-between rounded-lg border border-black/10 p-2 text-sm">
                <div><Link href="/incomes" className="text-cobalt underline">{i.concept}</Link><div className="text-xs text-ink/50">{i.clientName} {i.projectName && `· ${i.projectName}`}</div></div>
                <div className="text-right"><div className="font-semibold">USD {i.amountUsd.toFixed(2)}</div><div className="text-xs text-ink/40">{i.dueDate}</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-display text-lg text-ink">Proximos gastos (7 dias)</h3>
          <div className="mt-3 space-y-2">
            {data.upcomingExpenses.length === 0 && <p className="text-sm text-ink/40">Sin gastos proximos.</p>}
            {data.upcomingExpenses.map((e) => (
              <div key={e.id} className="flex justify-between rounded-lg border border-black/10 p-2 text-sm">
                <div><Link href="/expenses" className="text-cobalt underline">{e.concept}</Link><div className="text-xs text-ink/50">{e.categoryName} {e.projectName && `· ${e.projectName}`}</div></div>
                <div className="text-right"><div className="font-semibold">USD {e.amountUsd.toFixed(2)}</div><div className="text-xs text-ink/40">{e.dueDate}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
