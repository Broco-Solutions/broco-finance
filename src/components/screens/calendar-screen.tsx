"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import type {
  ExpenseCategoryRecord,
  ExpenseRecord,
  IncomeRecord,
  ProjectRecord,
  ScheduledExpenseRecord,
  ScheduledPaymentRecord,
} from "@/lib/types";
import { cn, formatShortDate, formatUsd } from "@/lib/utils";
import { DayActionModal } from "@/components/calendar/day-action-modal";
import { ExpenseEntryModal } from "@/components/calendar/expense-entry-modal";
import { IncomeEntryModal } from "@/components/calendar/income-entry-modal";
import { PayScheduledExpenseModal } from "@/components/expenses/pay-scheduled-expense-modal";
import { ScheduledPaymentSettlementModal } from "@/components/payments/scheduled-payment-settlement-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

type CalendarEventStatus = "cancelled" | "overdue" | "paid" | "pending";
type CalendarEventSource = "expense" | "income" | "scheduled-expense" | "scheduled-payment";

type CalendarEvent = {
  amountUsd: number;
  canOpen: boolean;
  date: string;
  direction: "expense" | "income";
  expense: ExpenseRecord | null;
  id: string;
  income: IncomeRecord | null;
  scheduledExpense: ScheduledExpenseRecord | null;
  scheduledPayment: ScheduledPaymentRecord | null;
  source: CalendarEventSource;
  state: CalendarEventStatus;
  subtitle: string;
  title: string;
};

const weekdayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const statusPriority: Record<CalendarEventStatus, number> = {
  overdue: 0,
  pending: 1,
  paid: 2,
  cancelled: 3,
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMonthTitle(value: Date) {
  return capitalize(format(value, "MMMM yyyy", { locale: es }));
}

function formatAgendaLabel(value: Date) {
  return capitalize(format(value, "EEEE d", { locale: es }));
}

function formatStateLabel(state: CalendarEventStatus) {
  if (state === "overdue") {
    return "Vencido";
  }

  if (state === "pending") {
    return "Pendiente";
  }

  if (state === "paid") {
    return "Pagado";
  }

  return "Cancelado";
}

function isOpenState(state: CalendarEventStatus) {
  return state === "pending" || state === "overdue";
}

function eventTone(event: CalendarEvent) {
  const directionTone =
    event.direction === "income"
      ? event.state === "overdue"
        ? "border-amber-900/18 bg-amber-50/85 text-amber-950"
        : "border-emerald-900/15 bg-emerald-50/85 text-emerald-950"
      : event.state === "overdue"
        ? "border-brick/18 bg-rose-50/90 text-rose-950"
        : "border-orange-900/15 bg-orange-50/88 text-orange-950";

  return cn(
    "w-full rounded-[1rem] border px-2.5 py-2 text-left transition",
    directionTone,
    event.state === "paid" && "opacity-60",
    event.state === "cancelled" && "opacity-40 line-through",
    event.canOpen && "hover:-translate-y-px hover:shadow-[0_16px_28px_rgba(16,21,34,0.08)] active:scale-[0.98]",
  );
}

function CalendarEventBadge({
  event,
  onOpen,
}: {
  event: CalendarEvent;
  onOpen: (event: CalendarEvent) => void;
}) {
  const icon =
    event.state === "paid" ? (
      <Check className="h-3.5 w-3.5" />
    ) : event.direction === "income" ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : (
      <ArrowDownRight className="h-3.5 w-3.5" />
    );

  const content = (
    <>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[12px] font-semibold">{event.title}</span>
          <span className="shrink-0 text-[11px] font-semibold">{formatUsd(event.amountUsd)}</span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-current/64">
          <span className="truncate">{event.subtitle}</span>
          <span className="shrink-0">{formatStateLabel(event.state)}</span>
        </span>
      </span>
    </>
  );

  if (!event.canOpen) {
    return <div className={cn("flex items-start gap-2", eventTone(event))}>{content}</div>;
  }

  return (
    <button
      className={cn("flex items-start gap-2", eventTone(event))}
      onClick={(eventClick) => {
        eventClick.stopPropagation();
        onOpen(event);
      }}
      type="button"
    >
      {content}
    </button>
  );
}

export function CalendarScreen({
  categories,
  demoMode,
  expenses,
  incomes,
  projects,
  scheduledExpenses,
  scheduledPayments,
}: {
  categories: ExpenseCategoryRecord[];
  demoMode: boolean;
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  projects: ProjectRecord[];
  scheduledExpenses: ScheduledExpenseRecord[];
  scheduledPayments: ScheduledPaymentRecord[];
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const deferredMonth = useDeferredValue(visibleMonth);
  const [isMonthPending, startMonthTransition] = useTransition();
  const [dayActionDate, setDayActionDate] = useState<string | null>(null);
  const [selectedScheduledPayment, setSelectedScheduledPayment] = useState<ScheduledPaymentRecord | null>(null);
  const [selectedScheduledExpense, setSelectedScheduledExpense] = useState<ScheduledExpenseRecord | null>(null);
  const [incomeEditor, setIncomeEditor] = useState<{ date: string; income: IncomeRecord | null; lockedReason?: string | null } | null>(null);
  const [expenseEditor, setExpenseEditor] = useState<{ date: string; expense: ExpenseRecord | null; lockedReason?: string | null } | null>(null);

  const events = useMemo<CalendarEvent[]>(() => {
    const linkedIncomeIds = new Set(
      scheduledPayments
        .map((payment) => payment.actualIncomeId)
        .filter((value): value is string => Boolean(value)),
    );
    const linkedExpenseIds = new Set(
      scheduledExpenses
        .map((expense) => expense.actualExpenseId)
        .filter((value): value is string => Boolean(value)),
    );

    const paymentEvents = scheduledPayments.map<CalendarEvent>((payment) => ({
      id: `scheduled-payment:${payment.id}`,
      date: payment.expectedDate,
      amountUsd: payment.expectedAmountUsd,
      title: payment.projectName,
      subtitle: `${payment.clientName} · programado`,
      direction: "income",
      source: "scheduled-payment",
      state: payment.status,
      canOpen: payment.status !== "paid" && payment.status !== "cancelled",
      scheduledPayment: payment,
      income: null,
      scheduledExpense: null,
      expense: null,
    }));

    const incomeEvents = incomes
      .filter((income) => !linkedIncomeIds.has(income.id))
      .map<CalendarEvent>((income) => ({
        id: `income:${income.id}`,
        date: income.displayStatus === "PAID" ? income.date : income.dueDate ?? income.date,
        amountUsd: income.amountUsd,
        title: income.projectName,
        subtitle: `${income.clientName} · ${income.type === "DEVELOPMENT" ? "desarrollo" : "mantenimiento"}`,
        direction: "income",
        source: "income",
        state:
          income.displayStatus === "PAID"
            ? "paid"
            : income.displayStatus === "OVERDUE"
              ? "overdue"
              : "pending",
        canOpen: true,
        scheduledPayment: null,
        income,
        scheduledExpense: null,
        expense: null,
      }));

    const scheduledExpenseEvents = scheduledExpenses.map<CalendarEvent>((expense) => ({
      id: `scheduled-expense:${expense.id}`,
      date: expense.dueDate,
      amountUsd: expense.amountUsd,
      title: expense.description,
      subtitle: `${expense.categoryName} · programado`,
      direction: "expense",
      source: "scheduled-expense",
      state: expense.status === "PAID" ? "paid" : "pending",
      canOpen: expense.status !== "PAID",
      scheduledPayment: null,
      income: null,
      scheduledExpense: expense,
      expense: null,
    }));

    const expenseEvents = expenses
      .filter((expense) => !linkedExpenseIds.has(expense.id) && !expense.scheduledExpenseId)
      .map<CalendarEvent>((expense) => ({
        id: `expense:${expense.id}`,
        date: expense.displayStatus === "PAID" ? expense.date : expense.dueDate ?? expense.date,
        amountUsd: expense.amountUsd,
        title: expense.description || expense.categoryName,
        subtitle: `${expense.categoryName}${expense.projectName ? ` · ${expense.projectName}` : ""}`,
        direction: "expense",
        source: "expense",
        state:
          expense.displayStatus === "PAID"
            ? "paid"
            : expense.displayStatus === "OVERDUE"
              ? "overdue"
              : "pending",
        canOpen: !expense.salaryWithdrawalId,
        scheduledPayment: null,
        income: null,
        scheduledExpense: null,
        expense,
      }));

    return [...paymentEvents, ...incomeEvents, ...scheduledExpenseEvents, ...expenseEvents];
  }, [expenses, incomes, scheduledExpenses, scheduledPayments]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const bucket = grouped.get(event.date) ?? [];
      bucket.push(event);
      grouped.set(event.date, bucket);
    }

    for (const bucket of grouped.values()) {
      bucket.sort((left, right) => {
        if (statusPriority[left.state] !== statusPriority[right.state]) {
          return statusPriority[left.state] - statusPriority[right.state];
        }

        if (left.direction !== right.direction) {
          return left.direction === "income" ? -1 : 1;
        }

        return right.amountUsd - left.amountUsd;
      });
    }

    return grouped;
  }, [events]);
  const incomesById = useMemo(() => new Map(incomes.map((income) => [income.id, income])), [incomes]);
  const expensesById = useMemo(() => new Map(expenses.map((expense) => [expense.id, expense])), [expenses]);

  const monthStart = useMemo(() => startOfMonth(deferredMonth), [deferredMonth]);
  const monthDays = useMemo(
    () =>
      eachDayOfInterval({
        start: monthStart,
        end: endOfMonth(monthStart),
      }),
    [monthStart],
  );
  const gridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
      }),
    [monthStart],
  );
  const monthEvents = useMemo(
    () => events.filter((event) => isSameMonth(parseISO(event.date), monthStart)),
    [events, monthStart],
  );
  const monthSummary = useMemo(
    () => ({
      openIncomeUsd: monthEvents
        .filter((event) => event.direction === "income" && isOpenState(event.state))
        .reduce((sum, event) => sum + event.amountUsd, 0),
      openExpenseUsd: monthEvents
        .filter((event) => event.direction === "expense" && isOpenState(event.state))
        .reduce((sum, event) => sum + event.amountUsd, 0),
      settledCount: monthEvents.filter((event) => event.state === "paid").length,
      totalCount: monthEvents.length,
    }),
    [monthEvents],
  );

  const openDayComposer = (date: string) => setDayActionDate(date);

  const openEvent = (event: CalendarEvent) => {
    if (event.source === "scheduled-payment" && event.scheduledPayment) {
      if (event.scheduledPayment.status === "paid" && event.scheduledPayment.actualIncomeId) {
        const linkedIncome = incomesById.get(event.scheduledPayment.actualIncomeId);

        if (linkedIncome) {
          setIncomeEditor({
            date: linkedIncome.date,
            income: linkedIncome,
            lockedReason: "Este cobro quedó conciliado desde un scheduled payment. Para corregirlo, ajustá el flujo programado.",
          });
        }
        return;
      }

      if (!event.canOpen) {
        return;
      }

      setSelectedScheduledPayment(event.scheduledPayment);
      return;
    }

    if (event.source === "scheduled-expense" && event.scheduledExpense) {
      if (event.scheduledExpense.status === "PAID" && event.scheduledExpense.actualExpenseId) {
        const linkedExpense = expensesById.get(event.scheduledExpense.actualExpenseId);

        if (linkedExpense) {
          setExpenseEditor({
            date: linkedExpense.date,
            expense: linkedExpense,
            lockedReason: "Este gasto se generó desde un pago recurrente ya conciliado. El ajuste se hace desde el compromiso original.",
          });
        }
        return;
      }

      if (!event.canOpen) {
        return;
      }

      setSelectedScheduledExpense(event.scheduledExpense);
      return;
    }

    if (event.source === "income" && event.income) {
      setIncomeEditor({ date: event.date, income: event.income, lockedReason: null });
      return;
    }

    if (event.source === "expense" && event.expense) {
      setExpenseEditor({
        date: event.date,
        expense: event.expense,
        lockedReason: event.expense.salaryWithdrawalId ? "Este gasto proviene de distribución y se edita desde ese módulo." : null,
      });
    }
  };

  const hasMonthTransition = isMonthPending || deferredMonth.getTime() !== visibleMonth.getTime();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Calendario"
        title="Calendario"
        description=""
        demoMode={demoMode}
      />

      <Card className="overflow-hidden border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,248,252,0.9))] p-0">
        <div className="border-b border-black/8 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="chip">Vista Mensual</div>
              <div>
                <h2 className="font-display text-3xl text-ink md:text-4xl">{formatMonthTitle(monthStart)}</h2>
                <p className="mt-2 max-w-2xl text-sm text-ink/60">
                  Click en una badge para cobrar, pagar o editar. Click en un espacio vacío para crear un nuevo movimiento con la fecha ya elegida.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => startMonthTransition(() => setVisibleMonth((current) => startOfMonth(addMonths(current, -1))))}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Mes anterior
              </Button>
              <Button type="button" variant="ghost" className="border border-black/10 bg-white/85" onClick={() => startMonthTransition(() => setVisibleMonth(startOfMonth(new Date())))}>
                Mes actual
              </Button>
              <Button type="button" variant="secondary" onClick={() => startMonthTransition(() => setVisibleMonth((current) => startOfMonth(addMonths(current, 1))))}>
                Mes siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-[1.2rem] border border-emerald-900/12 bg-emerald-50/75 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-950/70">Ingresos abiertos</div>
              <div className="mt-2 font-display text-2xl text-emerald-950">{formatUsd(monthSummary.openIncomeUsd)}</div>
            </div>
            <div className="rounded-[1.2rem] border border-orange-900/12 bg-orange-50/75 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-950/70">Gastos abiertos</div>
              <div className="mt-2 font-display text-2xl text-orange-950">{formatUsd(monthSummary.openExpenseUsd)}</div>
            </div>
            <div className="rounded-[1.2rem] border border-black/8 bg-white/85 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Movimientos cerrados</div>
              <div className="mt-2 font-display text-2xl text-ink">{monthSummary.settledCount}</div>
            </div>
            <div className="rounded-[1.2rem] border border-black/8 bg-white/85 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Eventos visibles</div>
              <div className="mt-2 font-display text-2xl text-ink">{monthSummary.totalCount}</div>
            </div>
          </div>

          {hasMonthTransition ? <p className="mt-3 text-xs uppercase tracking-[0.16em] text-ink/40">Actualizando vista…</p> : null}
        </div>

        {monthSummary.totalCount === 0 ? (
          <div className="border-b border-black/8 px-5 py-4 text-sm text-ink/55 md:px-6">
            No hay movimientos cargados para {formatMonthTitle(monthStart).toLowerCase()}.
          </div>
        ) : null}

        <div className="hidden md:block">
          <div className="grid grid-cols-7 border-b border-black/8 bg-black/[0.03]">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {gridDays.map((day, index) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(dateKey) ?? [];
              const currentMonth = isSameMonth(day, monthStart);

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "group relative flex min-h-[10.75rem] cursor-pointer flex-col p-3 transition",
                    index % 7 !== 0 && "border-l border-black/8",
                    index >= 7 && "border-t border-black/8",
                    currentMonth ? "bg-white/76 hover:bg-white/90" : "bg-black/[0.025] text-ink/38 hover:bg-black/[0.05]",
                  )}
                  onClick={() => openDayComposer(dateKey)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isToday(day) ? <span className="rounded-full bg-cobalt px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">Hoy</span> : null}
                      {dayEvents.length > 0 ? (
                        <span className="rounded-full bg-black/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-current/72">
                          {dayEvents.length} mov.
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                        isToday(day) ? "bg-ink text-paper" : "bg-white/85 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 overflow-y-auto pr-1">
                    {dayEvents.map((event) => (
                      <CalendarEventBadge key={event.id} event={event} onOpen={openEvent} />
                    ))}
                  </div>

                  {dayEvents.length === 0 ? (
                    <div className="mt-auto flex items-center gap-2 pt-6 text-[11px] uppercase tracking-[0.18em] text-current/40">
                      <Plus className="h-3.5 w-3.5" />
                      Agregar movimiento
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {monthDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                className="rounded-[1.5rem] border border-black/10 bg-white/85 p-4 shadow-[0_12px_24px_rgba(16,21,34,0.06)]"
                onClick={() => openDayComposer(dateKey)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{formatAgendaLabel(day)}</div>
                    <div className="mt-1 text-sm text-ink/55">{formatShortDate(day)}</div>
                  </div>
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition active:scale-[0.97]"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDayComposer(dateKey);
                    }}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {dayEvents.length === 0 ? (
                  <div className="mt-4 rounded-[1rem] border border-dashed border-black/10 bg-black/[0.025] px-4 py-3 text-sm text-ink/50">
                    Sin movimientos cargados. Tocá para crear uno.
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {dayEvents.map((event) => (
                      <CalendarEventBadge key={event.id} event={event} onOpen={openEvent} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <DayActionModal
        date={dayActionDate}
        expenseDisabled={categories.length === 0}
        incomeDisabled={projects.length === 0}
        open={Boolean(dayActionDate)}
        onClose={() => setDayActionDate(null)}
        onCreateExpense={() => {
          if (!dayActionDate) {
            return;
          }

          setExpenseEditor({ date: dayActionDate, expense: null, lockedReason: null });
          setDayActionDate(null);
        }}
        onCreateIncome={() => {
          if (!dayActionDate) {
            return;
          }

          setIncomeEditor({ date: dayActionDate, income: null, lockedReason: null });
          setDayActionDate(null);
        }}
      />

      <ScheduledPaymentSettlementModal
        demoMode={demoMode}
        open={Boolean(selectedScheduledPayment)}
        payment={selectedScheduledPayment}
        onClose={() => setSelectedScheduledPayment(null)}
      />

      <PayScheduledExpenseModal
        demoMode={demoMode}
        open={Boolean(selectedScheduledExpense)}
        scheduledExpense={selectedScheduledExpense}
        onClose={() => setSelectedScheduledExpense(null)}
      />

      <IncomeEntryModal
        date={incomeEditor?.date ?? new Date().toISOString().slice(0, 10)}
        demoMode={demoMode}
        income={incomeEditor?.income ?? null}
        lockedReason={incomeEditor?.lockedReason ?? null}
        open={Boolean(incomeEditor)}
        projects={projects}
        onClose={() => setIncomeEditor(null)}
      />

      <ExpenseEntryModal
        categories={categories}
        date={expenseEditor?.date ?? new Date().toISOString().slice(0, 10)}
        demoMode={demoMode}
        expense={expenseEditor?.expense ?? null}
        lockedReason={expenseEditor?.lockedReason ?? null}
        open={Boolean(expenseEditor)}
        projects={projects}
        onClose={() => setExpenseEditor(null)}
      />
    </div>
  );
}
