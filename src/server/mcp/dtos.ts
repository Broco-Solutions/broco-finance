function money(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: Date | string | null): string | null {
  if (!value) return null;
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

type Aggregate = {
  _sum: { amountUsd: unknown };
  _count: number;
};

export type FinancialSummaryDto = {
  ingresosCobrados: { cantidad: number; totalUsd: number };
  gastosPagados: { cantidad: number; totalUsd: number };
  netoCobradoUsd: number;
  ingresosPendientes: { cantidad: number; totalUsd: number };
  gastosPendientes: { cantidad: number; totalUsd: number };
  ingresosVencidos: { cantidad: number; totalUsd: number };
  gastosVencidos: { cantidad: number; totalUsd: number };
};

export function toFinancialSummaryDto(input: {
  paidIncomes: Aggregate;
  paidExpenses: Aggregate;
  pendingIncomes: Aggregate;
  pendingExpenses: Aggregate;
  overdueIncomes: Aggregate;
  overdueExpenses: Aggregate;
}): FinancialSummaryDto {
  const paidIncomesUsd = money(input.paidIncomes._sum.amountUsd);
  const paidExpensesUsd = money(input.paidExpenses._sum.amountUsd);
  return {
    ingresosCobrados: {
      cantidad: input.paidIncomes._count,
      totalUsd: paidIncomesUsd,
    },
    gastosPagados: {
      cantidad: input.paidExpenses._count,
      totalUsd: paidExpensesUsd,
    },
    netoCobradoUsd: paidIncomesUsd - paidExpensesUsd,
    ingresosPendientes: {
      cantidad: input.pendingIncomes._count,
      totalUsd: money(input.pendingIncomes._sum.amountUsd),
    },
    gastosPendientes: {
      cantidad: input.pendingExpenses._count,
      totalUsd: money(input.pendingExpenses._sum.amountUsd),
    },
    ingresosVencidos: {
      cantidad: input.overdueIncomes._count,
      totalUsd: money(input.overdueIncomes._sum.amountUsd),
    },
    gastosVencidos: {
      cantidad: input.overdueExpenses._count,
      totalUsd: money(input.overdueExpenses._sum.amountUsd),
    },
  };
}

export type ClientSummaryDto = {
  id: string;
  nombre: string;
  cantidadProyectos: number;
};

export function toClientSummaryDto(input: {
  id: string;
  name: string;
  _count: { projects: number };
}): ClientSummaryDto {
  return {
    id: input.id,
    nombre: input.name,
    cantidadProyectos: input._count.projects,
  };
}

export type ProjectSummaryDto = {
  id: string;
  nombre: string;
  cliente: { id: string; nombre: string };
  activo: boolean;
  inicio: string | null;
  fin: string | null;
  importeUnicoUsd: number | null;
  importeMensualUsd: number | null;
  cantidadIngresos: number;
  cantidadGastos: number;
};

export function toProjectSummaryDto(input: {
  id: string;
  name: string;
  isActive: boolean;
  startDate: Date | string | null;
  endDate: Date | string | null;
  oneTimeAmountUsd: unknown | null;
  monthlyRecurringAmountUsd: unknown | null;
  client: { id: string; name: string };
  _count: { incomes: number; expenses: number };
}): ProjectSummaryDto {
  return {
    id: input.id,
    nombre: input.name,
    cliente: { id: input.client.id, nombre: input.client.name },
    activo: input.isActive,
    inicio: date(input.startDate),
    fin: date(input.endDate),
    importeUnicoUsd:
      input.oneTimeAmountUsd === null ? null : money(input.oneTimeAmountUsd),
    importeMensualUsd:
      input.monthlyRecurringAmountUsd === null
        ? null
        : money(input.monthlyRecurringAmountUsd),
    cantidadIngresos: input._count.incomes,
    cantidadGastos: input._count.expenses,
  };
}

export type FlowIncomeDto = {
  id: string;
  concepto: string;
  vencimiento: string | null;
  montoUsd: number;
  cliente: string | null;
  proyecto: string | null;
};

export type FlowExpenseDto = {
  id: string;
  concepto: string;
  vencimiento: string | null;
  montoUsd: number;
  categoria: string;
  proyecto: string | null;
};

export function toFlowIncomeDto(input: {
  id: string;
  concept: string;
  dueDate: Date | string | null;
  amountUsd: unknown;
  client: { name: string } | null;
  project: { name: string } | null;
}): FlowIncomeDto {
  return {
    id: input.id,
    concepto: input.concept,
    vencimiento: date(input.dueDate),
    montoUsd: money(input.amountUsd),
    cliente: input.client?.name ?? null,
    proyecto: input.project?.name ?? null,
  };
}

export function toFlowExpenseDto(input: {
  id: string;
  concept: string;
  dueDate: Date | string | null;
  amountUsd: unknown;
  category: { name: string };
  project: { name: string } | null;
}): FlowExpenseDto {
  return {
    id: input.id,
    concepto: input.concept,
    vencimiento: date(input.dueDate),
    montoUsd: money(input.amountUsd),
    categoria: input.category.name,
    proyecto: input.project?.name ?? null,
  };
}
