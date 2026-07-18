import "server-only";
import { prisma } from "@/server/prisma";

function todayArg(): Date {
  const now = new Date();
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Cordoba", year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getDashboard(month?: number, year?: number) {
  const today = todayArg();
  const m = month ?? today.getMonth() + 1;
  const y = year ?? today.getFullYear();

  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);

  const paidIncomes = await prisma.income.aggregate({
    where: { status: "PAID", effectiveDate: { gte: from, lte: to } },
    _sum: { amountUsd: true }, _count: true,
  });
  const paidExpenses = await prisma.expense.aggregate({
    where: { status: "PAID", effectiveDate: { gte: from, lte: to } },
    _sum: { amountUsd: true }, _count: true,
  });
  const pendingIncomes = await prisma.income.aggregate({
    where: { status: "PENDING", dueDate: { gte: from, lte: to } },
    _sum: { amountUsd: true }, _count: true,
  });
  const pendingExpenses = await prisma.expense.aggregate({
    where: { status: "PENDING", dueDate: { gte: from, lte: to } },
    _sum: { amountUsd: true }, _count: true,
  });
  const overdueIncomes = await prisma.income.aggregate({
    where: { status: "PENDING", dueDate: { lt: today } },
    _sum: { amountUsd: true }, _count: true,
  });
  const overdueExpenses = await prisma.expense.aggregate({
    where: { status: "PENDING", dueDate: { lt: today } },
    _sum: { amountUsd: true }, _count: true,
  });

  const upcomingIncomes = await prisma.income.findMany({
    where: { status: "PENDING", dueDate: { gte: today, lte: new Date(today.getTime() + 7 * 86400000) } },
    orderBy: { dueDate: "asc" }, take: 10,
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });
  const upcomingExpenses = await prisma.expense.findMany({
    where: { status: "PENDING", dueDate: { gte: today, lte: new Date(today.getTime() + 7 * 86400000) } },
    orderBy: { dueDate: "asc" }, take: 10,
    include: { category: { select: { name: true } }, project: { select: { name: true } } },
  });
  const overdueList = await prisma.income.findMany({
    where: { status: "PENDING", dueDate: { lt: today } },
    orderBy: { dueDate: "asc" }, take: 10,
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });
  const overdueExpList = await prisma.expense.findMany({
    where: { status: "PENDING", dueDate: { lt: today } },
    orderBy: { dueDate: "asc" }, take: 10,
    include: { category: { select: { name: true } }, project: { select: { name: true } } },
  });

  return {
    period: { month: m, year: y },
    kpis: {
      paidIncomesUsd: Number(paidIncomes._sum.amountUsd ?? 0),
      paidExpensesUsd: Number(paidExpenses._sum.amountUsd ?? 0),
      paidIncomesCount: paidIncomes._count,
      paidExpensesCount: paidExpenses._count,
      netUsd: Number(paidIncomes._sum.amountUsd ?? 0) - Number(paidExpenses._sum.amountUsd ?? 0),
      pendingIncomesUsd: Number(pendingIncomes._sum.amountUsd ?? 0),
      pendingExpensesUsd: Number(pendingExpenses._sum.amountUsd ?? 0),
      overdueIncomesCount: overdueIncomes._count,
      overdueIncomesUsd: Number(overdueIncomes._sum.amountUsd ?? 0),
      overdueExpensesCount: overdueExpenses._count,
      overdueExpensesUsd: Number(overdueExpenses._sum.amountUsd ?? 0),
    },
    upcomingIncomes: upcomingIncomes.map((i) => ({
      id: i.id, concept: i.concept, dueDate: i.dueDate?.toISOString().slice(0, 10) ?? null,
      amountUsd: Number(i.amountUsd), clientName: i.client?.name ?? null, projectName: i.project?.name ?? null,
    })),
    upcomingExpenses: upcomingExpenses.map((e) => ({
      id: e.id, concept: e.concept, dueDate: e.dueDate?.toISOString().slice(0, 10) ?? null,
      amountUsd: Number(e.amountUsd), categoryName: e.category.name, projectName: e.project?.name ?? null,
    })),
    overdueIncomes: overdueList.map((i) => ({
      id: i.id, concept: i.concept, dueDate: i.dueDate?.toISOString().slice(0, 10) ?? null,
      amountUsd: Number(i.amountUsd), clientName: i.client?.name ?? null, projectName: i.project?.name ?? null,
    })),
    overdueExpenses: overdueExpList.map((e) => ({
      id: e.id, concept: e.concept, dueDate: e.dueDate?.toISOString().slice(0, 10) ?? null,
      amountUsd: Number(e.amountUsd), categoryName: e.category.name, projectName: e.project?.name ?? null,
    })),
  };
}
