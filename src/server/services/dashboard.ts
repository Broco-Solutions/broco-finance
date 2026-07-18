import "server-only";
import { prisma } from "@/server/prisma";
import { todayArg } from "@/lib/dates";

export async function getDashboard(from: Date, to: Date) {
  const today = todayArg();
  const in30 = new Date(today.getTime() + 30 * 86400000);

  const paidIncomes = await prisma.income.aggregate({
    where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true,
  });
  const paidExpenses = await prisma.expense.aggregate({
    where: { status: "PAID", effectiveDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true,
  });
  const pendingIncomes = await prisma.income.aggregate({
    where: { status: "PENDING", dueDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true,
  });
  const pendingExpenses = await prisma.expense.aggregate({
    where: { status: "PENDING", dueDate: { gte: from, lte: to } }, _sum: { amountUsd: true }, _count: true,
  });
  const overdueIncomes = await prisma.income.aggregate({
    where: { status: "PENDING", dueDate: { lt: today } }, _sum: { amountUsd: true }, _count: true,
  });
  const overdueExpenses = await prisma.expense.aggregate({
    where: { status: "PENDING", dueDate: { lt: today } }, _sum: { amountUsd: true }, _count: true,
  });

  const upcomingIncomes = await prisma.income.findMany({
    where: { status: "PENDING", dueDate: { gte: today, lte: in30 } },
    orderBy: { dueDate: "asc" }, take: 10,
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });
  const upcomingExpenses = await prisma.expense.findMany({
    where: { status: "PENDING", dueDate: { gte: today, lte: in30 } },
    orderBy: { dueDate: "asc" }, take: 10,
    include: { category: { select: { name: true } }, project: { select: { name: true } } },
  });
  const overdueIncList = await prisma.income.findMany({
    where: { status: "PENDING", dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 10,
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });
  const overdueExpList = await prisma.expense.findMany({
    where: { status: "PENDING", dueDate: { lt: today } }, orderBy: { dueDate: "asc" }, take: 10,
    include: { category: { select: { name: true } }, project: { select: { name: true } } },
  });

  return {
    kpis: {
      paidIncomesUsd: Number(paidIncomes._sum.amountUsd ?? 0), paidExpensesUsd: Number(paidExpenses._sum.amountUsd ?? 0),
      netUsd: Number(paidIncomes._sum.amountUsd ?? 0) - Number(paidExpenses._sum.amountUsd ?? 0),
      paidIncomesCount: paidIncomes._count, paidExpensesCount: paidExpenses._count,
      pendingIncomesUsd: Number(pendingIncomes._sum.amountUsd ?? 0), pendingExpensesUsd: Number(pendingExpenses._sum.amountUsd ?? 0),
      overdueIncomesCount: overdueIncomes._count, overdueIncomesUsd: Number(overdueIncomes._sum.amountUsd ?? 0),
      overdueExpensesCount: overdueExpenses._count, overdueExpensesUsd: Number(overdueExpenses._sum.amountUsd ?? 0),
    },
    upcomingIncomes: upcomingIncomes.map(i => ({ id: i.id, concept: i.concept, dueDate: i.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(i.amountUsd), clientName: i.client?.name??null, projectName: i.project?.name??null })),
    upcomingExpenses: upcomingExpenses.map(e => ({ id: e.id, concept: e.concept, dueDate: e.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(e.amountUsd), categoryName: e.category.name, projectName: e.project?.name??null })),
    overdueIncomes: overdueIncList.map(i => ({ id: i.id, concept: i.concept, dueDate: i.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(i.amountUsd), clientName: i.client?.name??null, projectName: i.project?.name??null })),
    overdueExpenses: overdueExpList.map(e => ({ id: e.id, concept: e.concept, dueDate: e.dueDate?.toISOString().slice(0,10)??null, amountUsd: Number(e.amountUsd), categoryName: e.category.name, projectName: e.project?.name??null })),
  };
}
