// @ts-nocheck
import "server-only";
import { prisma } from "@/server/prisma";
import { todayArg, todayKeyArgentina, toUtcDate } from "@/lib/dates";
import {
  getEvolutionMonths,
  bucketByMonth,
  computeTrend,
  classifyTrend,
  kpisForSeries,
  executivePhrase,
  pctVsPrev,
} from "@/lib/financial-trend";

export async function getDashboard(_from: Date, _to: Date) {
  const todayKey = todayKeyArgentina();
  const today = toUtcDate(todayKey);
  // Normalize to UTC midnight so Prisma compares correctly with @db.Date columns
  const from = new Date(Date.UTC(_from.getFullYear(), _from.getMonth(), _from.getDate()));
  const to = new Date(Date.UTC(_to.getFullYear(), _to.getMonth(), _to.getDate()));
  const in30 = new Date(today.getTime() + 30 * 86400000);

  // Generate projection months: next month + 5 more
  const projMonths: { start: Date; end: Date; label: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const m = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    projMonths.push({
      start: m,
      end,
      label: m.toLocaleDateString("es-AR", { month: "short", year: "numeric" }),
    });
  }

  const projectionQueries = projMonths.flatMap(({ start, end }) => [
    prisma.income.aggregate({
      where: {
        OR: [
          { status: "PENDING", dueDate: { gte: start, lte: end } },
          { status: "PAID", effectiveDate: { gte: start, lte: end } },
        ],
      },
      _sum: { amountUsd: true },
    }),
    prisma.expense.aggregate({
      where: {
        OR: [
          { status: "PENDING", dueDate: { gte: start, lte: end } },
          { status: "PAID", effectiveDate: { gte: start, lte: end } },
        ],
      },
      _sum: { amountUsd: true },
    }),
  ]);

  const mainResults = await Promise.all([
    prisma.income.aggregate({ where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.income.aggregate({ where: { status: "PENDING", dueDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PENDING", dueDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.income.aggregate({ where: { status: "PENDING", dueDate: { lt: today } }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PENDING", dueDate: { lt: today } }, _sum: { amountUsd: true }, _count: true }),
    prisma.income.findMany({ where: { status: "PENDING", dueDate: { gte: today, lte: in30 } }, orderBy: { dueDate: "asc" }, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.expense.findMany({ where: { status: "PENDING", dueDate: { gte: today, lte: in30 } }, orderBy: { dueDate: "asc" }, include: { category: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.income.findMany({ where: { status: "PENDING", dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 10, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.expense.findMany({ where: { status: "PENDING", dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 10, include: { category: { select: { name: true } }, project: { select: { name: true } } } }),
    // Global pendings (all time, independent of period)
    prisma.income.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true }, _count: true }),
    // Category breakdown for period
    prisma.expense.groupBy({ by: ["expenseCategoryId"], where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    // Income type breakdown for period (only Desarrollo/Mantenimiento)
    prisma.income.groupBy({ by: ["typeId"], where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    // Client breakdown for period
    prisma.income.findMany({ where: { status: "PAID", effectiveDate: { gte: from, lte: to }, clientId: { not: null } }, include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } }, orderBy: { client: { name: "asc" } } }),
  ]);
  const projResults = await Promise.all(projectionQueries);

  const [
    paidIncomes, paidExpenses, pendingIncomes, pendingExpenses, overdueIncomes, overdueExpenses,
    upcomingIncomes, upcomingExpenses, overdueIncList, overdueExpList,
    globalPendingInc, globalPendingExp,
    catBreakdown, incomeTypeBreakdown, clientBreakdown,
  ] = mainResults as any;

  // Process category breakdown
  const categories = await prisma.expenseCategory.findMany({ select: { id: true, name: true } });
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const catData = catBreakdown.map(c => ({ id: c.expenseCategoryId, name: catMap.get(c.expenseCategoryId) ?? "—", total: Number(c._sum.amountUsd ?? 0), count: c._count })).sort((a, b) => b.total - a.total);
  const catTotal = catData.reduce((s, c) => s + c.total, 0);

  // Process income type breakdown (only Desarrollo/Mantenimiento, no Otros)
  const incomeTypes = await prisma.incomeType.findMany({ select: { id: true, name: true } });
  const typeMap = new Map(incomeTypes.map((t) => [t.id, t.name]));
  const allowedTypeNames = new Set(["Desarrollo", "Mantenimiento"]);
  const typeDataRaw = (incomeTypeBreakdown as Array<{ typeId: string; _sum: { amountUsd: any }; _count: number }>).map((c) => ({
    id: c.typeId,
    name: typeMap.get(c.typeId) ?? "—",
    total: Number(c._sum.amountUsd ?? 0),
    count: c._count,
  }));
  const typeDataFiltered = typeDataRaw.filter((t) => allowedTypeNames.has(t.name) && t.total > 0);
  const typeData = typeDataFiltered.sort((a, b) => b.total - a.total);
  const typeTotal = typeData.reduce((s, c) => s + c.total, 0);

  // Process client breakdown
  const clientMap = new Map<string, { name: string; total: number; projects: { id: string; name: string; total: number }[] }>();
  for (const inc of clientBreakdown) {
    const cid = inc.clientId!;
    if (!clientMap.has(cid)) clientMap.set(cid, { name: inc.client!.name, total: 0, projects: [] });
    const entry = clientMap.get(cid)!;
    const amt = Number(inc.amountUsd);
    entry.total += amt;
    if (inc.projectId && inc.project) {
      const proj = entry.projects.find(p => p.id === inc.projectId);
      if (proj) proj.total += amt;
      else entry.projects.push({ id: inc.projectId, name: inc.project.name, total: amt });
    }
  }
  const clientData = Array.from(clientMap.entries()).map(([id, v]) => ({ id, name: v.name, total: v.total, projects: v.projects.sort((a, b) => b.total - a.total) })).sort((a, b) => b.total - a.total);

  return {
    kpis: {
      paidIncomesUsd: Number(paidIncomes._sum.amountUsd ?? 0), paidExpensesUsd: Number(paidExpenses._sum.amountUsd ?? 0),
      netUsd: Number(paidIncomes._sum.amountUsd ?? 0) - Number(paidExpenses._sum.amountUsd ?? 0),
      paidIncomesCount: paidIncomes._count, paidExpensesCount: paidExpenses._count,
      pendingIncomesUsd: Number(pendingIncomes._sum.amountUsd ?? 0), pendingExpensesUsd: Number(pendingExpenses._sum.amountUsd ?? 0),
      overdueIncomesCount: overdueIncomes._count, overdueIncomesUsd: Number(overdueIncomes._sum.amountUsd ?? 0),
      overdueExpensesCount: overdueExpenses._count, overdueExpensesUsd: Number(overdueExpenses._sum.amountUsd ?? 0),
      globalPendingIncomesUsd: Number(globalPendingInc._sum.amountUsd ?? 0), globalPendingExpensesUsd: Number(globalPendingExp._sum.amountUsd ?? 0),
    },
    upcomingIncomes: upcomingIncomes.map(i => ({ id: i.id, concept: i.concept, dueDate: i.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(i.amountUsd), clientName: i.client?.name??null, projectName: i.project?.name??null })),
    upcomingExpenses: upcomingExpenses.map(e => ({ id: e.id, concept: e.concept, dueDate: e.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(e.amountUsd), categoryName: e.category.name, projectName: e.project?.name??null })),
    overdueIncomes: overdueIncList.map(i => ({ id: i.id, concept: i.concept, dueDate: i.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(i.amountUsd), clientName: i.client?.name??null, projectName: i.project?.name??null })),
    overdueExpenses: overdueExpList.map(e => ({ id: e.id, concept: e.concept, dueDate: e.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(e.amountUsd), categoryName: e.category.name, projectName: e.project?.name??null })),
    categoryBreakdown: { total: catTotal, items: catData },
    incomeTypeBreakdown: { total: typeTotal, items: typeData },
    clientBreakdown: { total: clientData.reduce((s, c) => s + c.total, 0), items: clientData },
    projection: projMonths.map((m, i) => ({
      month: m.label,
      incomesUsd: Number(projResults[i * 2]._sum.amountUsd ?? 0),
      expensesUsd: Number(projResults[i * 2 + 1]._sum.amountUsd ?? 0),
      netUsd: Number(projResults[i * 2]._sum.amountUsd ?? 0) - Number(projResults[i * 2 + 1]._sum.amountUsd ?? 0),
    })),
  };
}

export async function getMcpFinancialSummary(from: Date, to: Date) {
  const today = toUtcDate(todayKeyArgentina());
  const range = { gte: from, lte: to };
  const overdueRange = { gte: from, lte: to, lt: today };

  const [
    paidIncomes,
    paidExpenses,
    pendingIncomes,
    pendingExpenses,
    overdueIncomes,
    overdueExpenses,
  ] = await Promise.all([
    prisma.income.aggregate({
      where: { status: "PAID", effectiveDate: range },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { status: "PAID", effectiveDate: range },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.income.aggregate({
      where: { status: "PENDING", dueDate: range },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { status: "PENDING", dueDate: range },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.income.aggregate({
      where: { status: "PENDING", dueDate: overdueRange },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { status: "PENDING", dueDate: overdueRange },
      _sum: { amountUsd: true },
      _count: true,
    }),
  ]);

  return {
    paidIncomes,
    paidExpenses,
    pendingIncomes,
    pendingExpenses,
    overdueIncomes,
    overdueExpenses,
  };
}

export async function getFinancialEvolution() {
  const todayKey = todayKeyArgentina();
  const ranges = {
    "6m": getEvolutionMonths(todayKey, "6m"),
    "12m": getEvolutionMonths(todayKey, "12m"),
    year: getEvolutionMonths(todayKey, "year"),
  };
  const incomeTypes = await prisma.incomeType.findMany({ where: { name: { in: ["Desarrollo", "Mantenimiento"] } }, select: { id: true, name: true } });

  // Determine overall min/max for fetching (including baseline one month before earliest)
  const allMonths = [...ranges["12m"], ...ranges["6m"], ...ranges.year];
  if (allMonths.length === 0) {
    // No closed months (e.g. January) -> return empty for all
    const empty = (range: typeof ranges["6m"]) => {
      const kpis = kpisForSeries(range);
      const trend = computeTrend(range);
      const cls = classifyTrend(trend.slope, range);
      return {
        months: range,
        kpis: { totalIncomes: kpis.totalIncomes, totalExpenses: kpis.totalExpenses, net: kpis.net, avgNet: kpis.avgNet },
        trend: { slope: trend.slope, intercept: trend.intercept, classification: cls.classification, threshold: cls.threshold, activeMonths: (cls as any).activeMonths ?? 0 },
        phrase: executivePhrase(cls.classification, trend.slope, range.length),
        rangeLabel: "",
      };
    };
    return {
      todayKey,
      ranges: {
        "6m": empty(ranges["6m"]),
        "12m": empty(ranges["12m"]),
        year: empty(ranges.year),
      },
    };
  }

  // Find earliest month among all ranges
  const sortedAll = [...allMonths].sort((a, b) => a.fromISO.localeCompare(b.fromISO));
  const earliest = sortedAll[0];
  const baselineDate = new Date(Date.UTC(earliest.year, earliest.month - 1, 1));
  baselineDate.setUTCMonth(baselineDate.getUTCMonth() - 1);
  const baselineYear = baselineDate.getUTCFullYear();
  const baselineMonth = baselineDate.getUTCMonth() + 1;
  const baselineFrom = new Date(Date.UTC(baselineYear, baselineMonth - 1, 1)).toISOString().slice(0, 10);
  const baselineTo = new Date(Date.UTC(baselineYear, baselineMonth, 0)).toISOString().slice(0, 10);
  const overallFrom = baselineFrom;
  const overallTo = [...allMonths].sort((a, b) => b.toISO.localeCompare(a.toISO))[0].toISO;

  const fromDate = toUtcDate(overallFrom);
  const toDate = toUtcDate(overallTo);

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { status: "PAID", effectiveDate: { gte: fromDate, lte: toDate } },
      select: { effectiveDate: true, amountUsd: true, typeId: true },
    }),
    prisma.expense.findMany({
      where: { status: "PAID", effectiveDate: { gte: fromDate, lte: toDate } },
      select: { effectiveDate: true, amountUsd: true },
    }),
  ]);

  function buildRange(rangeMonths: typeof ranges["6m"]) {
    if (rangeMonths.length === 0) {
      const kpis = kpisForSeries([]);
      const trend = computeTrend([]);
      const cls = classifyTrend(trend.slope, []);
      return {
        months: [] as ReturnType<typeof bucketByMonth>,
        kpis: { totalIncomes: 0, totalExpenses: 0, net: 0, avgNet: 0, avgMonthlyIncome: 0 },
        trend: { slope: 0, intercept: 0, classification: cls.classification, threshold: 0, activeMonths: (cls as any).activeMonths ?? 0 },
        phrase: executivePhrase(cls.classification, 0, 0),
        rangeLabel: "",
      };
    }
    // Baseline is month before start
    const first = rangeMonths[0];
    const baselineDate = new Date(Date.UTC(first.year, first.month - 1, 1));
    baselineDate.setUTCMonth(baselineDate.getUTCMonth() - 1);
    const bYear = baselineDate.getUTCFullYear();
    const bMonth = baselineDate.getUTCMonth() + 1;
    const bKey = `${bYear}-${String(bMonth).padStart(2, "0")}`;
    let bInc = 0;
    let bExp = 0;
    for (const inc of incomes) {
      const k = String(inc.effectiveDate).slice(0, 7);
      if (k === bKey) bInc += Number(inc.amountUsd ?? 0);
    }
    for (const exp of expenses) {
      const k = String(exp.effectiveDate).slice(0, 7);
      if (k === bKey) bExp += Number(exp.amountUsd ?? 0);
    }
    const baseline = { year: bYear, month: bMonth, incomesUsd: bInc, expensesUsd: bExp };
    const bucketed = bucketByMonth(rangeMonths, incomes, expenses, baseline);
    const withTrend = computeTrend(bucketed);
    const kpis = kpisForSeries(withTrend.withTrend);
    const cls = classifyTrend(withTrend.slope, withTrend.withTrend);
    const phrase = executivePhrase(cls.classification, withTrend.slope, withTrend.withTrend.length);
    const fromLabel = bucketed[0]?.label ?? "";
    const toLabel = bucketed[bucketed.length - 1]?.label ?? "";
    return {
      months: withTrend.withTrend,
      kpis: {
        totalIncomes: kpis.totalIncomes,
        totalExpenses: kpis.totalExpenses,
        net: kpis.net,
        avgNet: kpis.avgNet,
        avgMonthlyIncome: kpis.avgMonthlyIncome,
      },
      trend: {
        slope: withTrend.slope,
        intercept: withTrend.intercept,
        classification: cls.classification,
        threshold: cls.threshold,
        activeMonths: (cls as any).activeMonths ?? 0,
      },
      phrase,
      rangeLabel: fromLabel && toLabel ? `${fromLabel} — ${toLabel}` : "",
    };
  }

  return {
    todayKey,
    incomeTypes,
    ranges: {
      "6m": buildRange(ranges["6m"]),
      "12m": buildRange(ranges["12m"]),
      year: buildRange(ranges.year),
    },
  };
}
