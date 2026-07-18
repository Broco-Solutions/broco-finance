import "server-only";
import { prisma } from "@/server/prisma";
import { todayArg } from "@/lib/dates";

export async function getDashboard(from: Date, to: Date) {
  const today = todayArg();
  const in30 = new Date(today.getTime() + 30 * 86400000);

  const [paidIncomes, paidExpenses, pendingIncomes, pendingExpenses, overdueIncomes, overdueExpenses,
    upcomingIncomes, upcomingExpenses, overdueIncList, overdueExpList,
    globalPendingInc, globalPendingExp,
    catBreakdown, clientBreakdown,
  ] = await Promise.all([
    prisma.income.aggregate({ where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.income.aggregate({ where: { status: "PENDING", dueDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PENDING", dueDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    prisma.income.aggregate({ where: { status: "PENDING", dueDate: { lt: today } }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PENDING", dueDate: { lt: today } }, _sum: { amountUsd: true }, _count: true }),
    prisma.income.findMany({ where: { status: "PENDING", dueDate: { gte: today, lte: in30 } }, orderBy: { dueDate: "asc" }, take: 10, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.expense.findMany({ where: { status: "PENDING", dueDate: { gte: today, lte: in30 } }, orderBy: { dueDate: "asc" }, take: 10, include: { category: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.income.findMany({ where: { status: "PENDING", dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 10, include: { client: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.expense.findMany({ where: { status: "PENDING", dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 10, include: { category: { select: { name: true } }, project: { select: { name: true } } } }),
    // Global pendings (all time, independent of period)
    prisma.income.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true }, _count: true }),
    prisma.expense.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true }, _count: true }),
    // Category breakdown for period
    prisma.expense.groupBy({ by: ["expenseCategoryId"], where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true }),
    // Client breakdown for period
    prisma.income.findMany({ where: { status: "PAID", effectiveDate: { gte: from, lte: to }, clientId: { not: null } }, include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } }, orderBy: { client: { name: "asc" } } }),
  ]);

  // Process category breakdown
  const categories = await prisma.expenseCategory.findMany({ select: { id: true, name: true } });
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const catData = catBreakdown.map(c => ({ id: c.expenseCategoryId, name: catMap.get(c.expenseCategoryId) ?? "—", total: Number(c._sum.amountUsd ?? 0), count: c._count })).sort((a, b) => b.total - a.total);
  const catTotal = catData.reduce((s, c) => s + c.total, 0);

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
    clientBreakdown: { total: clientData.reduce((s, c) => s + c.total, 0), items: clientData },
  };
}
