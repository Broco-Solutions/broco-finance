import {
  ContractFrequency,
  DistributionLayer,
  ExpenseType,
  IncomeStatus,
  IncomeType,
  Prisma,
  ProjectStatus,
  ScheduledExpenseStatus,
  ScheduledPaymentStatus,
  type PrismaClient,
} from "@prisma/client";
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, isAfter, isBefore, parseISO, startOfDay, startOfMonth } from "date-fns";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import type {
  AlertsPayload,
  ClientDetailPayload,
  ClientRecord,
  DashboardPayload,
  DistributionPagePayload,
  DistributionRecord,
  DistributionSummary,
  ExpenseCategoryRecord,
  ExpenseRecord,
  IncomeRecord,
  ProjectDetailPayload,
  ProjectRecord,
  RecurringExpenseRecord,
  SalaryRecord,
  ScheduledExpenseRecord,
  ScheduledPaymentRecord,
} from "@/lib/types";
import {
  demoAlerts,
  demoCategories,
  demoClientDetails,
  demoClients,
  demoDistributionPage,
  demoExpenses,
  demoIncomes,
  demoLayers,
  demoProjectDetails,
  demoProjects,
  demoRecurringExpenses,
  demoSalaries,
  demoScheduledExpenses,
  demoScheduledPayments,
} from "@/server/demo-data";
import { AppError } from "@/server/errors";
import { hasDatabaseConfig, prisma } from "@/server/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const salaryCategoryName = "Sueldos/Honorarios";
const maintenanceScheduleHorizonMonths = 12;
const dashboardTag = "dashboard";

type ClientFinancialProject = {
  status: ProjectStatus | string;
  incomes: Array<{ amountUsd: Prisma.Decimal | number; status: IncomeStatus | string }>;
  scheduledPayments: Array<{ expectedAmountUsd: Prisma.Decimal | number; status: ScheduledPaymentStatus }>;
};

type ClientFinancialRecord = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  projects: ClientFinancialProject[];
};

type ProjectFinancialRecord = {
  id: string;
  clientId: string;
  name: string;
  status: ProjectStatus;
  devBudgetUsd: Prisma.Decimal | number | null;
  monthlyFeeUsd: Prisma.Decimal | number | null;
  monthlyFeeEndDate: Date | null;
  notes: string | null;
  client: { name: string };
  incomes: Array<{
    amountUsd: Prisma.Decimal | number;
    date: Date;
    status: IncomeStatus | string;
    type: IncomeType | string;
  }>;
  scheduledPayments: Array<{ expectedDate: Date; status: ScheduledPaymentStatus }>;
};

type IncomeWithProjectRecord = {
  id: string;
  projectId: string;
  date: Date;
  amountUsd: Prisma.Decimal | number;
  amountArs: Prisma.Decimal | number | null;
  exchangeRate: Prisma.Decimal | number | null;
  status: IncomeStatus;
  type: IncomeType;
  notes: string | null;
  project: {
    name: string;
    client: {
      name: string;
    };
  };
};

type ScheduledPaymentWithProjectRecord = {
  id: string;
  projectId: string;
  type: IncomeType;
  expectedDate: Date;
  expectedAmountUsd: Prisma.Decimal | number;
  status: ScheduledPaymentStatus;
  paidAt: Date | null;
  actualIncomeId: string | null;
  notes: string | null;
  project: {
    name: string;
    client: {
      name: string;
    };
  };
};

type RecurringExpenseWithScheduleRecord = {
  id: string;
  description: string;
  categoryId: string;
  amountUsd: Prisma.Decimal;
  startDate: Date;
  frequency: ContractFrequency;
  isActive: boolean;
  category: { name: string };
  scheduledExpenses: Array<{ dueDate: Date; status: ScheduledExpenseStatus }>;
};

type ScheduledExpenseWithRelationsRecord = {
  id: string;
  recurringExpenseId: string;
  dueDate: Date;
  amountUsd: Prisma.Decimal | number;
  status: ScheduledExpenseStatus;
  paidAt: Date | null;
  actualExpenseId: string | null;
  recurringExpense: {
    description: string;
    categoryId: string;
    category: {
      name: string;
    };
  };
};

type DashboardIncomeRow = {
  amountUsd: number;
  date: string;
  clientName: string;
};

type DashboardExpenseRow = {
  amountUsd: number;
  date: string;
  categoryName: string;
};

function isOpenScheduledStatus(status: ScheduledPaymentStatus) {
  return status === ScheduledPaymentStatus.pending || status === ScheduledPaymentStatus.overdue;
}

function isOpenScheduledExpenseStatus(status: ScheduledExpenseStatus | string) {
  return status === ScheduledExpenseStatus.PENDING;
}

function isPaidIncomeStatus(status: IncomeStatus | string) {
  return status === IncomeStatus.PAID;
}

function isPendingIncomeStatus(status: IncomeStatus | string) {
  return status === IncomeStatus.PENDING;
}

function isDevelopmentIncomeType(type: IncomeType | string) {
  return type === IncomeType.DEVELOPMENT;
}

function isMaintenanceIncomeType(type: IncomeType | string) {
  return type === IncomeType.MAINTENANCE;
}

function isActiveProjectStatus(status: ProjectStatus | string) {
  return status === ProjectStatus.ACTIVE;
}

function isClosedProjectStatus(status: ProjectStatus | string) {
  return status === ProjectStatus.COMPLETED || status === ProjectStatus.CANCELLED;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: string | null | undefined) {
  return value ? parseISO(value) : null;
}

const projectStatusSchema = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);
const incomeStatusSchema = z.enum(["PAID", "PENDING"]);
const incomeTypeSchema = z.enum(["DEVELOPMENT", "MAINTENANCE"]);
const expenseTypeSchema = z.enum(["fixed", "variable"]);
const contractFrequencySchema = z.enum(["monthly", "quarterly", "biannual", "annual"]);
const scheduledActionSchema = z.enum(["mark_paid", "cancel", "edit"]);
const scheduledExpenseStatusSchema = z.enum(["PENDING", "PAID"]);
const scheduledExpenseActionSchema = z.enum(["mark_paid"]);

const baseMoneySchema = z
  .object({
    amountUsd: z.coerce.number().nonnegative().optional(),
    amountArs: z.coerce.number().nonnegative().nullable().optional(),
    exchangeRate: z.coerce.number().positive().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasUsd = typeof value.amountUsd === "number";
    const hasArs = typeof value.amountArs === "number";
    const hasFx = typeof value.exchangeRate === "number";

    if (!hasUsd && !(hasArs && hasFx)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresá monto USD o ARS + tipo de cambio.",
      });
    }
  });

export const clientInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  contactName: z.string().trim().min(2, "El contacto debe tener al menos 2 caracteres.").nullable().optional(),
  contactEmail: z.string().trim().email("Email inválido.").nullable().optional(),
  contactPhone: z.string().trim().min(3, "Teléfono inválido.").nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const projectInputSchema = z.object({
  clientId: z.string().uuid("Cliente inválido."),
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  status: projectStatusSchema.default("ACTIVE"),
  devBudgetUsd: z.coerce.number().nonnegative().nullable().optional(),
  monthlyFeeUsd: z.coerce.number().nonnegative().nullable().optional(),
  monthlyFeeEndDate: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const incomeInputSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido."),
  date: z.string().min(8, "Fecha inválida."),
  status: incomeStatusSchema,
  type: incomeTypeSchema.default("DEVELOPMENT"),
  notes: z.string().trim().nullable().optional(),
}).merge(baseMoneySchema);

export const expenseCategoryInputSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio."),
});

export const expenseInputSchema = z.object({
  date: z.string().min(8, "Fecha inválida."),
  categoryId: z.string().uuid("Categoría inválida."),
  expenseType: expenseTypeSchema,
  projectId: z.string().uuid().nullable().optional(),
  description: z.string().min(2, "La descripción es obligatoria."),
  notes: z.string().trim().nullable().optional(),
}).merge(baseMoneySchema);

export const recurringExpenseInputSchema = z.object({
  description: z.string().min(2, "La descripción es obligatoria."),
  categoryId: z.string().uuid("Categoría inválida."),
  amountUsd: z.coerce.number().nonnegative(),
  startDate: z.string().min(8, "Fecha inválida."),
  frequency: contractFrequencySchema.default("monthly"),
  isActive: z.boolean().optional(),
  updatePendingExpenses: z.boolean().optional(),
});

export const scheduledPaymentInputSchema = z.object({
  action: scheduledActionSchema,
  expectedDate: z.string().nullable().optional(),
  expectedAmountUsd: z.coerce.number().nonnegative().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  incomeId: z.string().uuid().nullable().optional(),
  createIncome: incomeInputSchema.extend({ status: incomeStatusSchema.optional() }).nullable().optional(),
});

export const distributionInputSchema = z.object({
  layers: z
    .array(
      z.object({
        layer: z.enum(["emergency", "growth"]),
        currentAmountUsd: z.coerce.number().nonnegative(),
        storageLocation: z.string().trim().nullable().optional(),
      }),
    )
    .min(1),
});

export const salaryInputSchema = z.object({
  personName: z.string().min(2, "El nombre es obligatorio."),
  month: z.string().min(8, "Mes inválido."),
  date: z.string().min(8, "Fecha inválida."),
  notes: z.string().trim().nullable().optional(),
}).merge(baseMoneySchema);

export const dashboardFilterSchema = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

export const salaryFilterSchema = z.object({
  month: z.string().nullable().optional(),
  person: z.string().nullable().optional(),
});

export const scheduledFilterSchema = z.object({
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).nullable().optional(),
  type: incomeTypeSchema.nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

export const incomeFilterSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  status: z.enum(["PAID", "PENDING"]).nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

export const expenseFilterSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  type: z.enum(["fixed", "variable"]).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

export const recurringExpenseFilterSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  active: z.enum(["true", "false"]).nullable().optional(),
});

export const scheduledExpenseFilterSchema = z.object({
  status: scheduledExpenseStatusSchema.nullable().optional(),
  dueBefore: z.string().nullable().optional(),
  dueAfter: z.string().nullable().optional(),
  currentMonth: z.boolean().nullable().optional(),
  includeOverdue: z.boolean().nullable().optional(),
});

export const scheduledExpenseInputSchema = z.object({
  action: scheduledExpenseActionSchema,
  amountUsd: z.coerce.number().nonnegative(),
  paidAt: z.string().nullable().optional(),
});

function requireDatabase() {
  if (!hasDatabaseConfig()) {
    throw new AppError("Configurá DATABASE_URL para habilitar cambios persistentes.", 503);
  }
}

async function withDashboardRevalidation<T>(operation: Promise<T>) {
  const result = await operation;
  revalidateTag(dashboardTag);
  return result;
}

function dateOnly(value: Date | string) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return date.toISOString().slice(0, 10);
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function requireNumber(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0);
}

function calculateDevelopmentPending(devBudget: Prisma.Decimal | number | null | undefined, developmentCollectedUsd: number) {
  const budget = toNumber(devBudget);
  if (budget === null) {
    return null;
  }

  return Math.max(budget - developmentCollectedUsd, 0);
}

function sumIncomeUsd<T extends { amountUsd: Prisma.Decimal | number; status: IncomeStatus | string }>(
  incomes: T[],
  predicate: (income: T) => boolean = () => true,
) {
  return incomes.reduce((sum, income) => (predicate(income) ? sum + requireNumber(income.amountUsd) : sum), 0);
}

function nextReceivableDate(
  incomes: Array<{ date: Date; status: IncomeStatus | string }>,
  payments: Array<{ expectedDate: Date; status: ScheduledPaymentStatus }>,
) {
  const candidates = [
    ...incomes.filter((income) => isPendingIncomeStatus(income.status)).map((income) => income.date),
    ...payments.filter((payment) => isOpenScheduledStatus(payment.status)).map((payment) => payment.expectedDate),
  ].sort((a, b) => a.getTime() - b.getTime());

  return candidates[0] ?? null;
}

function normalizeMoney(input: { amountUsd?: number; amountArs?: number | null; exchangeRate?: number | null }) {
  const amountUsd =
    typeof input.amountUsd === "number"
      ? input.amountUsd
      : typeof input.amountArs === "number" && typeof input.exchangeRate === "number"
        ? input.amountArs / input.exchangeRate
        : null;

  if (amountUsd === null || Number.isNaN(amountUsd)) {
    throw new AppError("No se pudo calcular el monto en USD.", 422);
  }

  return {
    amountUsd: new Prisma.Decimal(amountUsd.toFixed(2)),
    amountArs: typeof input.amountArs === "number" ? new Prisma.Decimal(input.amountArs.toFixed(2)) : null,
    exchangeRate:
      typeof input.exchangeRate === "number" ? new Prisma.Decimal(input.exchangeRate.toFixed(4)) : null,
  };
}

function frequencyMonths(frequency: ContractFrequency) {
  switch (frequency) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "biannual":
      return 6;
    case "annual":
      return 12;
    default:
      return 1;
  }
}

function buildFutureExpenseSchedule(startDate: Date, frequency: ContractFrequency) {
  const dates: Date[] = [];
  const firstDate = startOfDay(startDate);
  const baseDate = isBefore(firstDate, startOfMonth(new Date())) ? startOfMonth(new Date()) : firstDate;
  let cursor = baseDate;

  while (dates.length < 12) {
    dates.push(cursor);
    cursor = addMonths(cursor, frequencyMonths(frequency));
  }

  return dates;
}

async function ensureSalaryCategory(db: DbClient) {
  return db.expenseCategory.upsert({
    where: { name: salaryCategoryName },
    update: { isDefault: true },
    create: { name: salaryCategoryName, isDefault: true },
  });
}

async function syncOverduePayments(db: DbClient) {
  await db.scheduledPayment.updateMany({
    where: {
      status: ScheduledPaymentStatus.pending,
      expectedDate: { lt: startOfDay(new Date()) },
    },
    data: { status: ScheduledPaymentStatus.overdue },
  });
}

async function syncOpenRecurringExpenses(db: DbClient) {
  const recurringExpenses = await db.recurringExpense.findMany({
    where: { isActive: true },
  });

  await Promise.all(recurringExpenses.map((recurringExpense) => syncScheduledExpensesForRecurringExpense(db, recurringExpense, false)));
}

function buildMaintenanceScheduleDates(referenceDate = new Date(), endDate: Date | null = null) {
  const firstDate = startOfMonth(referenceDate);
  const limitDate = endDate ? startOfMonth(endDate) : addMonths(firstDate, maintenanceScheduleHorizonMonths - 1);

  if (isAfter(firstDate, limitDate)) {
    return [];
  }

  const dates: Date[] = [];
  let cursor = firstDate;

  while (!isAfter(cursor, limitDate)) {
    dates.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return dates;
}

async function syncProjectMaintenanceSchedule(
  db: DbClient,
  project: {
    id: string;
    status: ProjectStatus;
    monthlyFeeUsd: Prisma.Decimal | number | null;
    monthlyFeeEndDate: Date | null;
  },
  updatePendingPayments: boolean,
) {
  const monthlyFeeUsd = toNumber(project.monthlyFeeUsd) ?? 0;
  const currentMonth = startOfMonth(new Date());
  const activeSubscription = isActiveProjectStatus(project.status) && monthlyFeeUsd > 0;

  if (!activeSubscription) {
    await db.scheduledPayment.deleteMany({
      where: {
        projectId: project.id,
        type: IncomeType.MAINTENANCE,
        status: ScheduledPaymentStatus.pending,
        expectedDate: { gte: currentMonth },
      },
    });
    return;
  }

  const contractEndMonth = project.monthlyFeeEndDate ? startOfMonth(project.monthlyFeeEndDate) : null;
  const existingPayments = await db.scheduledPayment.findMany({
    where: {
      projectId: project.id,
      type: IncomeType.MAINTENANCE,
    },
  });
  const scheduleStart =
    existingPayments
      .filter((payment) => payment.expectedDate >= currentMonth)
      .sort((left, right) => left.expectedDate.getTime() - right.expectedDate.getTime())[0]?.expectedDate ?? currentMonth;
  const scheduleDates = buildMaintenanceScheduleDates(scheduleStart, contractEndMonth);

  if (scheduleDates.length === 0) {
    await db.scheduledPayment.deleteMany({
      where: {
        projectId: project.id,
        type: IncomeType.MAINTENANCE,
        status: ScheduledPaymentStatus.pending,
        expectedDate: { gte: currentMonth },
      },
    });
    return;
  }

  const latestScheduledDate = scheduleDates[scheduleDates.length - 1];
  const existingKeys = new Set(existingPayments.map((payment) => dateOnly(payment.expectedDate)));
  const amountUsd = new Prisma.Decimal(monthlyFeeUsd.toFixed(2));

  await Promise.all(
    scheduleDates
      .filter((expectedDate) => !existingKeys.has(dateOnly(expectedDate)))
      .map((expectedDate) =>
        db.scheduledPayment.create({
          data: {
            projectId: project.id,
            type: IncomeType.MAINTENANCE,
            expectedDate,
            expectedAmountUsd: amountUsd,
            status: ScheduledPaymentStatus.pending,
            notes: "Cobro mensual de mantenimiento generado desde el proyecto.",
          },
        }),
      ),
  );

  if (updatePendingPayments) {
    await db.scheduledPayment.updateMany({
      where: {
        projectId: project.id,
        type: IncomeType.MAINTENANCE,
        status: ScheduledPaymentStatus.pending,
        expectedDate: { gte: scheduleStart },
      },
      data: {
        expectedAmountUsd: amountUsd,
      },
    });
  }

  await db.scheduledPayment.deleteMany({
    where: {
      projectId: project.id,
      type: IncomeType.MAINTENANCE,
      status: ScheduledPaymentStatus.pending,
      expectedDate: { gt: latestScheduledDate },
    },
  });
}

async function syncProjectMaintenanceFee(
  db: DbClient,
  projectId: string,
  nextMonthlyFeeUsd: Prisma.Decimal,
) {
  const project = await db.project.update({
    where: { id: projectId },
    data: {
      monthlyFeeUsd: nextMonthlyFeeUsd,
    },
    select: {
      id: true,
      status: true,
      monthlyFeeUsd: true,
      monthlyFeeEndDate: true,
    },
  });

  await syncProjectMaintenanceSchedule(db, project, true);
  return project;
}

async function syncProjectSubscriptions(db: DbClient) {
  const projects = await db.project.findMany({
    where: {
      OR: [
        {
          monthlyFeeUsd: {
            gt: new Prisma.Decimal(0),
          },
        },
        {
          scheduledPayments: {
            some: {
              type: IncomeType.MAINTENANCE,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      status: true,
      monthlyFeeUsd: true,
      monthlyFeeEndDate: true,
    },
  });

  await Promise.all(projects.map((project) => syncProjectMaintenanceSchedule(db, project, false)));
}

async function clearPendingScheduledExpenses(db: DbClient, recurringExpenseId: string) {
  await db.scheduledExpense.deleteMany({
    where: {
      recurringExpenseId,
      status: ScheduledExpenseStatus.PENDING,
    },
  });
}

async function ensurePendingIncomeAllowed(db: DbClient, projectId: string, status: IncomeStatus | string) {
  if (!isPendingIncomeStatus(status)) {
    return;
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      name: true,
    },
  });

  if (!project) {
    throw new AppError("Proyecto no encontrado.", 404);
  }

  if (isClosedProjectStatus(project.status)) {
    throw new AppError(
      `El proyecto "${project.name}" está ${project.status === ProjectStatus.COMPLETED ? "completado" : "cancelado"} y no admite ingresos pendientes nuevos.`,
      409,
    );
  }
}

async function syncScheduledExpensesForRecurringExpense(
  db: DbClient,
  recurringExpense: {
    id: string;
    amountUsd: Prisma.Decimal;
    frequency: ContractFrequency;
    startDate: Date;
    isActive: boolean;
  },
  updatePendingExpenses: boolean,
) {
  if (!recurringExpense.isActive) {
    return;
  }

  const dates = buildFutureExpenseSchedule(recurringExpense.startDate, recurringExpense.frequency);
  const existing = await db.scheduledExpense.findMany({
    where: { recurringExpenseId: recurringExpense.id },
  });
  const existingKeys = new Set(existing.map((expense) => dateOnly(expense.dueDate)));
  const amountUsd = requireNumber(recurringExpense.amountUsd);

  await Promise.all(
    dates
      .filter((date) => !existingKeys.has(dateOnly(date)))
      .map((dueDate) =>
        db.scheduledExpense.create({
          data: {
            recurringExpenseId: recurringExpense.id,
            dueDate,
            amountUsd,
            status: ScheduledExpenseStatus.PENDING,
          },
        }),
      ),
  );

  if (updatePendingExpenses) {
    await db.scheduledExpense.updateMany({
      where: {
        recurringExpenseId: recurringExpense.id,
        status: ScheduledExpenseStatus.PENDING,
        dueDate: {
          gte: startOfDay(new Date()),
        },
      },
      data: {
        amountUsd,
      },
    });
  }
}

function filterByRange<T extends { date?: string; expectedDate?: string }>(items: T[], from?: string | null, to?: string | null) {
  const fromDate = from ? parseISO(from) : null;
  const toDate = to ? parseISO(to) : null;

  return items.filter((item) => {
    const value = item.date ?? item.expectedDate;
    if (!value) {
      return true;
    }

    const date = parseISO(value);

    if (fromDate && isBefore(date, fromDate)) {
      return false;
    }

    if (toDate && isAfter(date, toDate)) {
      return false;
    }

    return true;
  });
}

function computeDistributionSummary(
  incomes: Array<{ amountUsd: number }>,
  expenses: Array<{ amountUsd: number }>,
  layers: Array<{ currentAmountUsd: number }>,
): DistributionSummary {
  const totalIncomeUsd = incomes.reduce((sum, item) => sum + item.amountUsd, 0);
  const totalExpenseUsd = expenses.reduce((sum, item) => sum + item.amountUsd, 0);
  const layersUsd = layers.reduce((sum, item) => sum + item.currentAmountUsd, 0);
  const netResultUsd = totalIncomeUsd - totalExpenseUsd;

  return {
    totalIncomeUsd,
    totalExpenseUsd,
    netResultUsd,
    remanenteUsd: netResultUsd - layersUsd,
  };
}

function mapDemoClients(search?: string | null) {
  const query = search?.trim().toLowerCase();
  return query
    ? demoClients.filter((client) =>
        [client.name, client.contactName, client.contactEmail, client.contactPhone, client.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : demoClients;
}

function mapDemoProjects(filters?: { clientId?: string | null; status?: string | null }) {
  return demoProjects.filter((project) => {
    if (filters?.clientId && project.clientId !== filters.clientId) {
      return false;
    }
    if (filters?.status && project.status !== filters.status) {
      return false;
    }
    return true;
  });
}

function mapDemoIncomes(filters?: z.infer<typeof incomeFilterSchema>) {
  return filterByRange(
    demoIncomes.filter((income) => {
      if (filters?.projectId && income.projectId !== filters.projectId) {
        return false;
      }
      if (filters?.clientId && demoProjects.find((project) => project.id === income.projectId)?.clientId !== filters.clientId) {
        return false;
      }
      if (filters?.status && income.status !== filters.status) {
        return false;
      }
      return true;
    }),
    filters?.from,
    filters?.to,
  );
}

function mapDemoExpenses(filters?: z.infer<typeof expenseFilterSchema>) {
  return filterByRange(
    demoExpenses.filter((expense) => {
      if (filters?.categoryId && expense.categoryId !== filters.categoryId) {
        return false;
      }
      if (filters?.type && expense.expenseType !== filters.type) {
        return false;
      }
      if (filters?.projectId && expense.projectId !== filters.projectId) {
        return false;
      }
      return true;
    }),
    filters?.from,
    filters?.to,
  );
}

function mapDemoScheduledPayments(filters?: z.infer<typeof scheduledFilterSchema>) {
  return filterByRange(
    demoScheduledPayments.filter((payment) => {
      const project = demoProjects.find((candidate) => candidate.id === payment.projectId);
      if (filters?.status && payment.status !== filters.status) {
        return false;
      }
      if (filters?.type && payment.type !== filters.type) {
        return false;
      }
      if (filters?.projectId && payment.projectId !== filters.projectId) {
        return false;
      }
      if (filters?.clientId && project?.clientId !== filters.clientId) {
        return false;
      }
      return true;
    }),
    filters?.from,
    filters?.to,
  );
}

function mapDemoRecurringExpenses(filters?: z.infer<typeof recurringExpenseFilterSchema>) {
  return demoRecurringExpenses.filter((item) => {
    if (filters?.categoryId && item.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters?.active) {
      const active = filters.active === "true";
      return item.isActive === active;
    }
    return true;
  });
}

function mapDemoScheduledExpenses(filters?: z.infer<typeof scheduledExpenseFilterSchema>) {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  return demoScheduledExpenses.filter((item) => {
    const dueDate = parseISO(item.dueDate);

    if (filters?.status && item.status !== filters.status) {
      return false;
    }
    if (filters?.dueAfter && isBefore(dueDate, parseISO(filters.dueAfter))) {
      return false;
    }
    if (filters?.dueBefore && isAfter(dueDate, parseISO(filters.dueBefore))) {
      return false;
    }
    if (filters?.currentMonth && (isBefore(dueDate, monthStart) || isAfter(dueDate, monthEnd))) {
      return false;
    }
    if (filters?.includeOverdue === false && isBefore(dueDate, monthStart)) {
      return false;
    }
    if (filters?.includeOverdue && isAfter(dueDate, monthEnd)) {
      return false;
    }

    return true;
  });
}

function mapClientRecord(client: ClientFinancialRecord): ClientRecord {
  const allIncomes = client.projects.flatMap((project) => project.incomes);
  const pendingPayments = client.projects.flatMap((project) => project.scheduledPayments).filter((payment) => isOpenScheduledStatus(payment.status));

  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    notes: client.notes,
    totalInvoicedUsd: allIncomes.reduce((sum, income) => sum + requireNumber(income.amountUsd), 0),
    totalReceivableUsd:
      sumIncomeUsd(allIncomes, (income) => isPendingIncomeStatus(income.status)) +
      pendingPayments.reduce((sum, payment) => sum + requireNumber(payment.expectedAmountUsd), 0),
    activeProjects: client.projects.filter((project) => isActiveProjectStatus(project.status)).length,
    totalProjects: client.projects.length,
  };
}

function mapProjectRecord(
  project: ProjectFinancialRecord,
): ProjectRecord {
  const nextPayment = nextReceivableDate(project.incomes, project.scheduledPayments);
  const developmentCollectedUsd = sumIncomeUsd(
    project.incomes,
    (income) => isPaidIncomeStatus(income.status) && isDevelopmentIncomeType(income.type),
  );
  const maintenanceCollectedUsd = sumIncomeUsd(
    project.incomes,
    (income) => isPaidIncomeStatus(income.status) && isMaintenanceIncomeType(income.type),
  );

  return {
    id: project.id,
    clientId: project.clientId,
    clientName: project.client.name,
    name: project.name,
    status: project.status,
    devBudgetUsd: toNumber(project.devBudgetUsd),
    monthlyFeeUsd: toNumber(project.monthlyFeeUsd),
    monthlyFeeEndDate: project.monthlyFeeEndDate ? dateOnly(project.monthlyFeeEndDate) : null,
    notes: project.notes,
    pendingIncomeCount: project.incomes.filter((income) => isPendingIncomeStatus(income.status)).length,
    developmentCollectedUsd,
    maintenanceCollectedUsd,
    developmentPendingUsd: calculateDevelopmentPending(project.devBudgetUsd, developmentCollectedUsd),
    totalCollectedUsd: developmentCollectedUsd + maintenanceCollectedUsd,
    nextPaymentDate: nextPayment ? dateOnly(nextPayment) : null,
  };
}

function mapIncomeRecord(
  income: IncomeWithProjectRecord,
): IncomeRecord {
  return {
    id: income.id,
    projectId: income.projectId,
    projectName: income.project.name,
    clientName: income.project.client.name,
    date: dateOnly(income.date),
    amountUsd: requireNumber(income.amountUsd),
    amountArs: toNumber(income.amountArs),
    exchangeRate: toNumber(income.exchangeRate),
    status: income.status,
    type: income.type,
    notes: income.notes,
  };
}

function mapExpenseCategory(category: { id: string; name: string; isDefault: boolean }): ExpenseCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    isDefault: category.isDefault,
  };
}

function mapExpenseRecord(
  expense: {
    id: string;
    date: Date;
    categoryId: string;
    expenseType: ExpenseType;
    projectId: string | null;
    amountUsd: Prisma.Decimal | number;
    amountArs: Prisma.Decimal | number | null;
    exchangeRate: Prisma.Decimal | number | null;
    description: string;
    salaryWithdrawalId: string | null;
    notes: string | null;
    category: { name: string };
    project: { name: string } | null;
    scheduledExpense?: { id: string } | null;
  },
): ExpenseRecord {
  return {
    id: expense.id,
    date: dateOnly(expense.date),
    categoryId: expense.categoryId,
    categoryName: expense.category.name,
    expenseType: expense.expenseType,
    projectId: expense.projectId,
    projectName: expense.project?.name ?? null,
    amountUsd: requireNumber(expense.amountUsd),
    amountArs: toNumber(expense.amountArs),
    exchangeRate: toNumber(expense.exchangeRate),
    description: expense.description,
    salaryWithdrawalId: expense.salaryWithdrawalId,
    scheduledExpenseId: expense.scheduledExpense?.id ?? null,
    notes: expense.notes,
  };
}

function mapDistributionRecord(layer: { id: string; layer: DistributionLayer; currentAmountUsd: Prisma.Decimal | number; storageLocation: string | null }): DistributionRecord {
  return {
    id: layer.id,
    layer: layer.layer,
    currentAmountUsd: requireNumber(layer.currentAmountUsd),
    storageLocation: layer.storageLocation,
  };
}

function mapSalaryRecord(record: Prisma.SalaryWithdrawalGetPayload<object>): SalaryRecord {
  return {
    id: record.id,
    personName: record.personName,
    month: dateOnly(record.month),
    date: dateOnly(record.date),
    amountUsd: requireNumber(record.amountUsd),
    amountArs: toNumber(record.amountArs),
    exchangeRate: toNumber(record.exchangeRate),
    notes: record.notes,
  };
}

function mapScheduledPaymentRecord(
  record: ScheduledPaymentWithProjectRecord,
): ScheduledPaymentRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.project.name,
    clientName: record.project.client.name,
    type: record.type,
    expectedDate: dateOnly(record.expectedDate),
    expectedAmountUsd: requireNumber(record.expectedAmountUsd),
    status: record.status,
    paidAt: record.paidAt ? dateOnly(record.paidAt) : null,
    actualIncomeId: record.actualIncomeId,
    notes: record.notes,
  };
}

function mapRecurringExpenseRecord(
  recurringExpense: RecurringExpenseWithScheduleRecord,
): RecurringExpenseRecord {
  const nextDue = recurringExpense.scheduledExpenses
    .filter((expense) => isOpenScheduledExpenseStatus(expense.status))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  return {
    id: recurringExpense.id,
    description: recurringExpense.description,
    categoryId: recurringExpense.categoryId,
    categoryName: recurringExpense.category.name,
    amountUsd: requireNumber(recurringExpense.amountUsd),
    startDate: dateOnly(recurringExpense.startDate),
    frequency: recurringExpense.frequency,
    isActive: recurringExpense.isActive,
    nextDueDate: nextDue ? dateOnly(nextDue.dueDate) : null,
    pendingCount: recurringExpense.scheduledExpenses.filter((expense) => expense.status === ScheduledExpenseStatus.PENDING).length,
  };
}

function mapScheduledExpenseRecord(
  scheduledExpense: ScheduledExpenseWithRelationsRecord,
): ScheduledExpenseRecord {
  return {
    id: scheduledExpense.id,
    recurringExpenseId: scheduledExpense.recurringExpenseId,
    description: scheduledExpense.recurringExpense.description,
    categoryId: scheduledExpense.recurringExpense.categoryId,
    categoryName: scheduledExpense.recurringExpense.category.name,
    dueDate: dateOnly(scheduledExpense.dueDate),
    amountUsd: requireNumber(scheduledExpense.amountUsd),
    status: scheduledExpense.status,
    paidAt: scheduledExpense.paidAt ? dateOnly(scheduledExpense.paidAt) : null,
    actualExpenseId: scheduledExpense.actualExpenseId,
  };
}

export async function listClients(search?: string | null) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoClients(search), demoMode: true };
  }

  await syncProjectSubscriptions(prisma);
  await syncOverduePayments(prisma);

  const clients = await prisma.client.findMany({
    where: search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              contactName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              contactEmail: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              contactPhone: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      notes: true,
      projects: {
        select: {
          status: true,
          incomes: {
            select: {
              amountUsd: true,
              status: true,
            },
          },
          scheduledPayments: {
            select: {
              expectedAmountUsd: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return { data: clients.map(mapClientRecord), demoMode: false };
}

export async function getClientDetail(id: string): Promise<ClientDetailPayload> {
  if (!hasDatabaseConfig()) {
    const detail = demoClientDetails.get(id);
    if (!detail) {
      throw new AppError("Cliente no encontrado.", 404);
    }
    return {
      ...detail,
      incomes: detail.incomes
        .filter((income) => isPaidIncomeStatus(income.status))
        .sort((left, right) => right.date.localeCompare(left.date)),
      payments: detail.payments
        .filter((payment) => isOpenScheduledStatus(payment.status as ScheduledPaymentStatus))
        .sort((left, right) => left.expectedDate.localeCompare(right.expectedDate)),
    };
  }

  await syncProjectSubscriptions(prisma);
  await syncOverduePayments(prisma);

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      notes: true,
      projects: {
        select: {
          id: true,
          clientId: true,
          name: true,
          status: true,
          devBudgetUsd: true,
          monthlyFeeUsd: true,
          monthlyFeeEndDate: true,
          notes: true,
          client: {
            select: {
              name: true,
            },
          },
          incomes: {
            select: {
              amountUsd: true,
              date: true,
              status: true,
              type: true,
            },
          },
          scheduledPayments: {
            select: {
              expectedAmountUsd: true,
              expectedDate: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!client) {
    throw new AppError("Cliente no encontrado.", 404);
  }

  const projects = client.projects.map(mapProjectRecord);

  const incomes = await prisma.income.findMany({
    where: {
      project: { clientId: id },
      status: IncomeStatus.PAID,
    },
    select: {
      id: true,
      projectId: true,
      date: true,
      amountUsd: true,
      amountArs: true,
      exchangeRate: true,
      status: true,
      type: true,
      notes: true,
      project: {
        select: {
          name: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  const payments = await prisma.scheduledPayment.findMany({
    where: {
      project: { clientId: id },
      status: {
        in: [ScheduledPaymentStatus.pending, ScheduledPaymentStatus.overdue],
      },
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      expectedDate: true,
      expectedAmountUsd: true,
      status: true,
      paidAt: true,
      actualIncomeId: true,
      notes: true,
      project: {
        select: {
          name: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { expectedDate: "asc" },
  });

  return {
    client: mapClientRecord(client),
    projects,
    incomes: incomes.map(mapIncomeRecord),
    payments: payments.map(mapScheduledPaymentRecord),
  };
}

export async function createClient(input: z.infer<typeof clientInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.client.create({
    data: {
      name: input.name.trim(),
      contactName: normalizeOptionalText(input.contactName),
      contactEmail: normalizeOptionalText(input.contactEmail),
      contactPhone: normalizeOptionalText(input.contactPhone),
      notes: normalizeOptionalText(input.notes),
    },
  }));
}

export async function updateClient(id: string, input: z.infer<typeof clientInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.client.update({
    where: { id },
    data: {
      name: input.name.trim(),
      contactName: normalizeOptionalText(input.contactName),
      contactEmail: normalizeOptionalText(input.contactEmail),
      contactPhone: normalizeOptionalText(input.contactPhone),
      notes: normalizeOptionalText(input.notes),
    },
  }));
}

export async function deleteClient(id: string) {
  requireDatabase();

  const [activeProjectCount, projectCount] = await Promise.all([
    prisma.project.count({ where: { clientId: id, status: ProjectStatus.ACTIVE } }),
    prisma.project.count({ where: { clientId: id } }),
  ]);

  if (activeProjectCount > 0) {
    throw new AppError("No podés eliminar un cliente con proyectos activos. Cerrá o cancelá esos proyectos primero.", 409);
  }

  if (projectCount > 0) {
    throw new AppError("No podés eliminar un cliente con proyectos asociados. Eliminá o archivá esos proyectos antes.", 409);
  }

  await withDashboardRevalidation(prisma.client.delete({ where: { id } }));
}

export async function listProjects(filters?: { clientId?: string | null; status?: string | null }) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoProjects(filters), demoMode: true };
  }

  await syncProjectSubscriptions(prisma);
  await syncOverduePayments(prisma);

  const projects = await prisma.project.findMany({
    where: {
      clientId: filters?.clientId ?? undefined,
      status: (filters?.status as ProjectStatus | undefined) ?? undefined,
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      status: true,
      devBudgetUsd: true,
      monthlyFeeUsd: true,
      monthlyFeeEndDate: true,
      notes: true,
      client: {
        select: {
          name: true,
        },
      },
      incomes: {
        select: {
          amountUsd: true,
          date: true,
          status: true,
          type: true,
        },
      },
      scheduledPayments: {
        select: {
          expectedDate: true,
          status: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return { data: projects.map(mapProjectRecord), demoMode: false };
}

export async function getProjectDetail(id: string): Promise<ProjectDetailPayload> {
  if (!hasDatabaseConfig()) {
    const detail = demoProjectDetails.get(id);
    if (!detail) {
      throw new AppError("Proyecto no encontrado.", 404);
    }
    return {
      ...detail,
      incomes: detail.incomes
        .filter((income) => isPaidIncomeStatus(income.status))
        .sort((left, right) => right.date.localeCompare(left.date)),
      scheduledPayments: detail.scheduledPayments
        .filter((payment) => isOpenScheduledStatus(payment.status as ScheduledPaymentStatus))
        .sort((left, right) => left.expectedDate.localeCompare(right.expectedDate)),
    };
  }

  await syncProjectSubscriptions(prisma);
  await syncOverduePayments(prisma);

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      name: true,
      status: true,
      devBudgetUsd: true,
      monthlyFeeUsd: true,
      monthlyFeeEndDate: true,
      notes: true,
      client: {
        select: {
          name: true,
        },
      },
      incomes: {
        select: {
          id: true,
          projectId: true,
          date: true,
          amountUsd: true,
          amountArs: true,
          exchangeRate: true,
          status: true,
          type: true,
          notes: true,
          project: {
            select: {
              name: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
      },
      scheduledPayments: {
        select: {
          id: true,
          projectId: true,
          type: true,
          expectedDate: true,
          expectedAmountUsd: true,
          status: true,
          paidAt: true,
          actualIncomeId: true,
          notes: true,
          project: {
            select: {
              name: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { expectedDate: "asc" },
      },
      expenses: {
        select: {
          id: true,
          date: true,
          categoryId: true,
          expenseType: true,
          projectId: true,
          amountUsd: true,
          amountArs: true,
          exchangeRate: true,
          description: true,
          salaryWithdrawalId: true,
          notes: true,
          category: {
            select: {
              name: true,
            },
          },
          project: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!project) {
    throw new AppError("Proyecto no encontrado.", 404);
  }

  return {
    project: mapProjectRecord(project),
    incomes: project.incomes
      .filter((income) => isPaidIncomeStatus(income.status))
      .map(mapIncomeRecord)
      .sort((left, right) => right.date.localeCompare(left.date)),
    scheduledPayments: project.scheduledPayments
      .filter((payment) => isOpenScheduledStatus(payment.status))
      .map(mapScheduledPaymentRecord)
      .sort((left, right) => left.expectedDate.localeCompare(right.expectedDate)),
    expenses: project.expenses.map(mapExpenseRecord),
  };
}

export async function createProject(input: z.infer<typeof projectInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        clientId: input.clientId,
        name: input.name.trim(),
        status: input.status as ProjectStatus,
        devBudgetUsd:
          typeof input.devBudgetUsd === "number" ? new Prisma.Decimal(input.devBudgetUsd.toFixed(2)) : null,
        monthlyFeeUsd:
          typeof input.monthlyFeeUsd === "number" ? new Prisma.Decimal(input.monthlyFeeUsd.toFixed(2)) : null,
        monthlyFeeEndDate: normalizeOptionalDate(input.monthlyFeeEndDate),
        notes: normalizeOptionalText(input.notes),
      },
    });

    await syncProjectMaintenanceSchedule(tx, project, true);
    return project;
  }));
}

export async function updateProject(id: string, input: z.infer<typeof projectInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id },
      data: {
        clientId: input.clientId,
        name: input.name.trim(),
        status: input.status as ProjectStatus,
        devBudgetUsd:
          typeof input.devBudgetUsd === "number" ? new Prisma.Decimal(input.devBudgetUsd.toFixed(2)) : null,
        monthlyFeeUsd:
          typeof input.monthlyFeeUsd === "number" ? new Prisma.Decimal(input.monthlyFeeUsd.toFixed(2)) : null,
        monthlyFeeEndDate: normalizeOptionalDate(input.monthlyFeeEndDate),
        notes: normalizeOptionalText(input.notes),
      },
    });

    await syncProjectMaintenanceSchedule(tx, project, true);
    return project;
  }));
}

export async function deleteProject(id: string) {
  requireDatabase();

  const [incomeCount, expenseCount, scheduledPaymentCount] = await Promise.all([
    prisma.income.count({ where: { projectId: id } }),
    prisma.expense.count({ where: { projectId: id } }),
    prisma.scheduledPayment.count({ where: { projectId: id } }),
  ]);

  if (incomeCount + expenseCount + scheduledPaymentCount > 0) {
    throw new AppError(
      "No podés eliminar un proyecto con ingresos, gastos o cobros programados asociados. Cambiá su estado a CANCELLED si querés dejarlo fuera de operación.",
      409,
    );
  }

  await withDashboardRevalidation(prisma.project.delete({ where: { id } }));
}

export async function listIncomes(filters?: z.infer<typeof incomeFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoIncomes(filters), demoMode: true };
  }

  const items = await prisma.income.findMany({
    where: {
      projectId: filters?.projectId ?? undefined,
      status: (filters?.status as IncomeStatus | undefined) ?? undefined,
      project: filters?.clientId ? { clientId: filters.clientId } : undefined,
      date: {
        gte: filters?.from ? parseISO(filters.from) : undefined,
        lte: filters?.to ? parseISO(filters.to) : undefined,
      },
    },
    select: {
      id: true,
      projectId: true,
      date: true,
      amountUsd: true,
      amountArs: true,
      exchangeRate: true,
      status: true,
      type: true,
      notes: true,
      project: {
        select: {
          name: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return { data: items.map(mapIncomeRecord), demoMode: false };
}

export async function createIncome(input: z.infer<typeof incomeInputSchema>) {
  requireDatabase();
  await ensurePendingIncomeAllowed(prisma, input.projectId, input.status);
  const money = normalizeMoney(input);

  return withDashboardRevalidation(prisma.income.create({
    data: {
      projectId: input.projectId,
      date: parseISO(input.date),
      status: input.status as IncomeStatus,
      type: input.type as IncomeType,
      notes: normalizeOptionalText(input.notes),
      ...money,
    },
  }));
}

export async function updateIncome(id: string, input: z.infer<typeof incomeInputSchema>) {
  requireDatabase();
  const linkedPayment = await prisma.scheduledPayment.findUnique({
    where: { actualIncomeId: id },
  });

  if (linkedPayment) {
    throw new AppError("Editá el pago programado para ajustar un ingreso conciliado con recurrentes.", 409);
  }

  await ensurePendingIncomeAllowed(prisma, input.projectId, input.status);
  const money = normalizeMoney(input);

  return withDashboardRevalidation(prisma.income.update({
    where: { id },
    data: {
      projectId: input.projectId,
      date: parseISO(input.date),
      status: input.status as IncomeStatus,
      type: input.type as IncomeType,
      notes: normalizeOptionalText(input.notes),
      ...money,
    },
  }));
}

export async function deleteIncome(id: string) {
  requireDatabase();

  const payment = await prisma.scheduledPayment.findUnique({
    where: { actualIncomeId: id },
  });

  if (payment) {
    throw new AppError("No podés eliminar un ingreso conciliado con un pago programado.", 409);
  }

  await withDashboardRevalidation(prisma.income.delete({ where: { id } }));
}

export async function listExpenseCategories() {
  if (!hasDatabaseConfig()) {
    return { data: demoCategories, demoMode: true };
  }

  const categories = await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
  });

  return { data: categories.map(mapExpenseCategory), demoMode: false };
}

export async function createExpenseCategory(input: z.infer<typeof expenseCategoryInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.expenseCategory.create({
    data: {
      name: input.name.trim(),
      isDefault: false,
    },
  }));
}

export async function updateExpenseCategory(id: string, input: z.infer<typeof expenseCategoryInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.expenseCategory.update({
    where: { id },
    data: {
      name: input.name.trim(),
    },
  }));
}

export async function deleteExpenseCategory(id: string) {
  requireDatabase();

  const [expenseCount, recurringExpenseCount] = await Promise.all([
    prisma.expense.count({ where: { categoryId: id } }),
    prisma.recurringExpense.count({ where: { categoryId: id } }),
  ]);

  if (expenseCount > 0 || recurringExpenseCount > 0) {
    throw new AppError(
      "No podés eliminar una categoría con gastos o plantillas recurrentes asociados. Reasigná esos movimientos antes.",
      409,
    );
  }

  await withDashboardRevalidation(prisma.expenseCategory.delete({
    where: { id },
  }));
}

export async function listExpenses(filters?: z.infer<typeof expenseFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoExpenses(filters), demoMode: true };
  }

  const items = await prisma.expense.findMany({
    where: {
      categoryId: filters?.categoryId ?? undefined,
      expenseType: (filters?.type as ExpenseType | undefined) ?? undefined,
      projectId: filters?.projectId ?? undefined,
      date: {
        gte: filters?.from ? parseISO(filters.from) : undefined,
        lte: filters?.to ? parseISO(filters.to) : undefined,
      },
    },
    select: {
      id: true,
      date: true,
      categoryId: true,
      expenseType: true,
      projectId: true,
      amountUsd: true,
      amountArs: true,
      exchangeRate: true,
      description: true,
      salaryWithdrawalId: true,
      notes: true,
      category: {
        select: {
          name: true,
        },
      },
      project: {
        select: {
          name: true,
        },
      },
      scheduledExpense: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return { data: items.map(mapExpenseRecord), demoMode: false };
}

export async function createExpense(input: z.infer<typeof expenseInputSchema>) {
  requireDatabase();
  const money = normalizeMoney(input);

  return withDashboardRevalidation(prisma.expense.create({
    data: {
      date: parseISO(input.date),
      categoryId: input.categoryId,
      expenseType: input.expenseType as ExpenseType,
      projectId: input.projectId ?? null,
      description: input.description.trim(),
      notes: input.notes ?? null,
      ...money,
    },
  }));
}

export async function updateExpense(id: string, input: z.infer<typeof expenseInputSchema>) {
  requireDatabase();
  const current = await prisma.expense.findUnique({ where: { id } });

  if (!current) {
    throw new AppError("Gasto no encontrado.", 404);
  }

  if (current.salaryWithdrawalId) {
    throw new AppError("Los gastos creados por salarios se editan desde distribución.", 409);
  }

  const linkedScheduledExpense = await prisma.scheduledExpense.findUnique({
    where: { actualExpenseId: id },
  });

  if (linkedScheduledExpense) {
    throw new AppError("Los gastos creados desde recurrentes se editan desde el pago programado.", 409);
  }

  const money = normalizeMoney(input);

  return withDashboardRevalidation(prisma.expense.update({
    where: { id },
    data: {
      date: parseISO(input.date),
      categoryId: input.categoryId,
      expenseType: input.expenseType as ExpenseType,
      projectId: input.projectId ?? null,
      description: input.description.trim(),
      notes: input.notes ?? null,
      ...money,
    },
  }));
}

export async function deleteExpense(id: string) {
  requireDatabase();
  const current = await prisma.expense.findUnique({ where: { id } });

  if (!current) {
    throw new AppError("Gasto no encontrado.", 404);
  }

  if (current.salaryWithdrawalId) {
    throw new AppError("Los gastos creados por salarios se eliminan desde distribución.", 409);
  }

  const linkedScheduledExpense = await prisma.scheduledExpense.findUnique({
    where: { actualExpenseId: id },
  });

  if (linkedScheduledExpense) {
    throw new AppError("Los gastos creados desde recurrentes se eliminan desde el pago programado.", 409);
  }

  await withDashboardRevalidation(prisma.expense.delete({ where: { id } }));
}

export async function listRecurringExpenses(filters?: z.infer<typeof recurringExpenseFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoRecurringExpenses(filters), demoMode: true };
  }

  await syncOpenRecurringExpenses(prisma);

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: {
      categoryId: filters?.categoryId ?? undefined,
      isActive: filters?.active ? filters.active === "true" : undefined,
    },
    select: {
      id: true,
      description: true,
      categoryId: true,
      amountUsd: true,
      startDate: true,
      frequency: true,
      isActive: true,
      category: {
        select: {
          name: true,
        },
      },
      scheduledExpenses: {
        select: {
          dueDate: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: recurringExpenses.map(mapRecurringExpenseRecord), demoMode: false };
}

export async function createRecurringExpense(input: z.infer<typeof recurringExpenseInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const recurringExpense = await tx.recurringExpense.create({
      data: {
        description: input.description.trim(),
        categoryId: input.categoryId,
        amountUsd: new Prisma.Decimal(input.amountUsd.toFixed(2)),
        startDate: parseISO(input.startDate),
        frequency: input.frequency as ContractFrequency,
        isActive: input.isActive ?? true,
      },
    });

    if (recurringExpense.isActive) {
      await syncScheduledExpensesForRecurringExpense(tx, recurringExpense, true);
    }

    return recurringExpense;
  }));
}

export async function updateRecurringExpense(id: string, input: z.infer<typeof recurringExpenseInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const recurringExpense = await tx.recurringExpense.update({
      where: { id },
      data: {
        description: input.description.trim(),
        categoryId: input.categoryId,
        amountUsd: new Prisma.Decimal(input.amountUsd.toFixed(2)),
        startDate: parseISO(input.startDate),
        frequency: input.frequency as ContractFrequency,
        isActive: input.isActive ?? true,
      },
    });

    if (!recurringExpense.isActive) {
      await clearPendingScheduledExpenses(tx, recurringExpense.id);
      return recurringExpense;
    }

    if (input.updatePendingExpenses ?? true) {
      await tx.scheduledExpense.deleteMany({
        where: {
          recurringExpenseId: recurringExpense.id,
          status: ScheduledExpenseStatus.PENDING,
          dueDate: {
            gte: startOfDay(new Date()),
          },
        },
      });
    }

    await syncScheduledExpensesForRecurringExpense(tx, recurringExpense, input.updatePendingExpenses ?? true);
    return recurringExpense;
  }));
}

export async function listScheduledExpenses(filters?: z.infer<typeof scheduledExpenseFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoScheduledExpenses(filters), demoMode: true };
  }

  await syncOpenRecurringExpenses(prisma);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const dueDateWhere: Prisma.DateTimeFilter = {
    gte: filters?.dueAfter
      ? parseISO(filters.dueAfter)
      : filters?.currentMonth && !filters?.includeOverdue
        ? monthStart
        : undefined,
    lte: filters?.dueBefore
      ? parseISO(filters.dueBefore)
      : filters?.currentMonth || filters?.includeOverdue
        ? monthEnd
        : undefined,
  };

  const scheduledExpenses = await prisma.scheduledExpense.findMany({
    where: {
      status: (filters?.status as ScheduledExpenseStatus | undefined) ?? undefined,
      dueDate:
        Object.values(dueDateWhere).some((value) => value !== undefined)
          ? dueDateWhere
          : undefined,
    },
    select: {
      id: true,
      recurringExpenseId: true,
      dueDate: true,
      amountUsd: true,
      status: true,
      paidAt: true,
      actualExpenseId: true,
      recurringExpense: {
        select: {
          description: true,
          categoryId: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return { data: scheduledExpenses.map(mapScheduledExpenseRecord), demoMode: false };
}

export async function updateScheduledExpense(id: string, input: z.infer<typeof scheduledExpenseInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const scheduledExpense = await tx.scheduledExpense.findUnique({
      where: { id },
      include: {
        recurringExpense: true,
      },
    });

    if (!scheduledExpense) {
      throw new AppError("Gasto programado no encontrado.", 404);
    }

    if (scheduledExpense.status === ScheduledExpenseStatus.PAID) {
      return scheduledExpense;
    }

    const paidAt = input.paidAt ? parseISO(input.paidAt) : startOfDay(new Date());
    const finalAmountUsd = new Prisma.Decimal(input.amountUsd.toFixed(2));

    const createdExpense = await tx.expense.create({
      data: {
        date: paidAt,
        categoryId: scheduledExpense.recurringExpense.categoryId,
        expenseType: ExpenseType.fixed,
        projectId: null,
        amountUsd: finalAmountUsd,
        amountArs: null,
        exchangeRate: null,
        description: scheduledExpense.recurringExpense.description,
        notes: "Pago registrado desde gasto recurrente.",
      },
    });

    return tx.scheduledExpense.update({
      where: { id },
      data: {
        amountUsd: finalAmountUsd,
        status: ScheduledExpenseStatus.PAID,
        paidAt,
        actualExpenseId: createdExpense.id,
      },
    });
  }));
}

export async function getDistributionPage(month?: string | null): Promise<DistributionPagePayload> {
  if (!hasDatabaseConfig()) {
    return {
      ...demoDistributionPage,
      salaries: month
        ? demoDistributionPage.salaries.filter((salary) => salary.month === month)
        : demoDistributionPage.salaries,
    };
  }

  const [layers, incomes, expenses, salaries] = await Promise.all([
    prisma.distributionConfig.findMany({ orderBy: { layer: "asc" } }),
    prisma.income.findMany({ where: { status: IncomeStatus.PAID }, select: { amountUsd: true } }),
    prisma.expense.findMany({ select: { amountUsd: true } }),
    prisma.salaryWithdrawal.findMany({
      where: {
        month: month ? parseISO(month) : undefined,
      },
      orderBy: [{ month: "desc" }, { personName: "asc" }],
    }),
  ]);

  return {
    layers: layers.map(mapDistributionRecord),
    summary: computeDistributionSummary(
      incomes.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
      expenses.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
      layers.map((item) => ({ currentAmountUsd: requireNumber(item.currentAmountUsd) })),
    ),
    salaries: salaries.map(mapSalaryRecord),
  };
}

export async function updateDistribution(input: z.infer<typeof distributionInputSchema>) {
  requireDatabase();

  await withDashboardRevalidation(Promise.all(
    input.layers.map((layer) =>
      prisma.distributionConfig.upsert({
        where: { layer: layer.layer as DistributionLayer },
        update: {
          currentAmountUsd: new Prisma.Decimal(layer.currentAmountUsd.toFixed(2)),
          storageLocation: layer.storageLocation ?? null,
        },
        create: {
          layer: layer.layer as DistributionLayer,
          currentAmountUsd: new Prisma.Decimal(layer.currentAmountUsd.toFixed(2)),
          storageLocation: layer.storageLocation ?? null,
        },
      }),
    ),
  ));
}

export async function listSalary(filters?: z.infer<typeof salaryFilterSchema>) {
  if (!hasDatabaseConfig()) {
    let salaries = demoSalaries;
    if (filters?.month) {
      salaries = salaries.filter((item) => item.month === filters.month);
    }
    if (filters?.person) {
      salaries = salaries.filter((item) => item.personName.toLowerCase().includes(filters.person!.toLowerCase()));
    }
    return { data: salaries, demoMode: true };
  }

  const items = await prisma.salaryWithdrawal.findMany({
    where: {
      month: filters?.month ? parseISO(filters.month) : undefined,
      personName: filters?.person ? { contains: filters.person, mode: "insensitive" } : undefined,
    },
    orderBy: [{ month: "desc" }, { personName: "asc" }],
  });

  return { data: items.map(mapSalaryRecord), demoMode: false };
}

export async function createSalary(input: z.infer<typeof salaryInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const salaryCategory = await ensureSalaryCategory(tx);
    const money = normalizeMoney(input);

    const salary = await tx.salaryWithdrawal.create({
      data: {
        personName: input.personName.trim(),
        month: parseISO(input.month),
        date: parseISO(input.date),
        notes: input.notes ?? null,
        ...money,
      },
    });

    await tx.expense.create({
      data: {
        date: parseISO(input.date),
        categoryId: salaryCategory.id,
        expenseType: ExpenseType.fixed,
        amountUsd: money.amountUsd,
        amountArs: money.amountArs,
        exchangeRate: money.exchangeRate,
        description: `Salario ${input.personName.trim()} - ${format(parseISO(input.month), "MMM yyyy")}`,
        salaryWithdrawalId: salary.id,
        notes: input.notes ?? null,
      },
    });

    return salary;
  }));
}

export async function deleteSalary(id: string) {
  requireDatabase();
  await withDashboardRevalidation(prisma.salaryWithdrawal.delete({ where: { id } }));
}

export async function listScheduledPayments(filters?: z.infer<typeof scheduledFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoScheduledPayments(filters), demoMode: true };
  }

  await syncProjectSubscriptions(prisma);
  await syncOverduePayments(prisma);

  const items = await prisma.scheduledPayment.findMany({
    where: {
      status: (filters?.status as ScheduledPaymentStatus | undefined) ?? undefined,
      type: (filters?.type as IncomeType | undefined) ?? undefined,
      projectId: filters?.projectId ?? undefined,
      project: filters?.clientId ? { clientId: filters.clientId } : undefined,
      expectedDate: {
        gte: filters?.from ? parseISO(filters.from) : undefined,
        lte: filters?.to ? parseISO(filters.to) : undefined,
      },
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      expectedDate: true,
      expectedAmountUsd: true,
      status: true,
      paidAt: true,
      actualIncomeId: true,
      notes: true,
      project: {
        select: {
          name: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { expectedDate: "asc" },
  });

  return { data: items.map(mapScheduledPaymentRecord), demoMode: false };
}

export async function updateScheduledPayment(id: string, input: z.infer<typeof scheduledPaymentInputSchema>) {
  requireDatabase();

  return withDashboardRevalidation(prisma.$transaction(async (tx) => {
    const payment = await tx.scheduledPayment.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!payment) {
      throw new AppError("Pago programado no encontrado.", 404);
    }

    if (payment.status === ScheduledPaymentStatus.paid && input.action !== "edit") {
      return payment;
    }

    if (input.action === "cancel") {
      return tx.scheduledPayment.update({
        where: { id },
        data: {
          status: ScheduledPaymentStatus.cancelled,
          paidAt: null,
          notes: input.notes ?? payment.notes,
        },
      });
    }

    if (input.action === "edit") {
      return tx.scheduledPayment.update({
        where: { id },
        data: {
          expectedDate: input.expectedDate ? parseISO(input.expectedDate) : payment.expectedDate,
          expectedAmountUsd:
            typeof input.expectedAmountUsd === "number"
              ? new Prisma.Decimal(input.expectedAmountUsd.toFixed(2))
              : payment.expectedAmountUsd,
          notes: input.notes ?? payment.notes,
        },
      });
    }

    let incomeId = input.incomeId ?? null;
    const paidAt = input.paidAt ? parseISO(input.paidAt) : startOfDay(new Date());
    const inferredIncomeType = payment.type;
    let settledAmountUsd =
      typeof input.expectedAmountUsd === "number"
        ? new Prisma.Decimal(input.expectedAmountUsd.toFixed(2))
        : payment.expectedAmountUsd;

    if (!incomeId && input.createIncome) {
      const money = normalizeMoney(input.createIncome);
      const createdIncome = await tx.income.create({
        data: {
          projectId: input.createIncome.projectId,
          date: parseISO(input.createIncome.date),
          status: IncomeStatus.PAID,
          type: (input.createIncome.type as IncomeType | undefined) ?? inferredIncomeType,
          notes: input.createIncome.notes ?? null,
          ...money,
        },
      });
      incomeId = createdIncome.id;
      settledAmountUsd = money.amountUsd;
    }

    if (!incomeId) {
      const createdIncome = await tx.income.create({
        data: {
          projectId: payment.projectId,
          date: paidAt,
          status: IncomeStatus.PAID,
          type: inferredIncomeType,
          notes: input.notes ?? payment.notes ?? "Cobro registrado desde pago programado.",
          amountUsd: settledAmountUsd,
          amountArs: null,
          exchangeRate: null,
        },
      });
      incomeId = createdIncome.id;
    }

    if (!incomeId) {
      throw new AppError("Seleccioná o creá un ingreso para marcar como cobrado.", 422);
    }

    const updatedPayment = await tx.scheduledPayment.update({
      where: { id },
      data: {
        status: ScheduledPaymentStatus.paid,
        paidAt,
        actualIncomeId: incomeId,
        notes: input.notes ?? payment.notes,
        expectedAmountUsd: settledAmountUsd,
      },
    });

    if (
      payment.type === IncomeType.MAINTENANCE &&
      requireNumber(settledAmountUsd) !== requireNumber(payment.expectedAmountUsd)
    ) {
      await syncProjectMaintenanceFee(tx, payment.projectId, settledAmountUsd);
    }

    return updatedPayment;
  }));
}

async function getAlertsFromDatabase({ skipSync = false }: { skipSync?: boolean } = {}): Promise<AlertsPayload> {
  if (!skipSync) {
    await syncProjectSubscriptions(prisma);
    await syncOverduePayments(prisma);
  }

  const now = startOfDay(new Date());
  const in7 = addDays(now, 7);
  const in30 = addDays(now, 30);

  const payments = await prisma.scheduledPayment.findMany({
    where: {
      status: {
        in: [ScheduledPaymentStatus.pending, ScheduledPaymentStatus.overdue],
      },
      expectedDate: { lte: in30 },
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      expectedDate: true,
      expectedAmountUsd: true,
      status: true,
      paidAt: true,
      actualIncomeId: true,
      notes: true,
      project: {
        select: {
          name: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { expectedDate: "asc" },
  });
  const endingProjects = await prisma.project.findMany({
    where: {
      status: ProjectStatus.ACTIVE,
      monthlyFeeUsd: {
        gt: new Prisma.Decimal(0),
      },
      monthlyFeeEndDate: {
        gte: now,
        lte: in30,
      },
    },
    select: {
      id: true,
      name: true,
      monthlyFeeUsd: true,
      monthlyFeeEndDate: true,
      client: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { monthlyFeeEndDate: "asc" },
  });

  const mapped = payments.map(mapScheduledPaymentRecord);
  const overdue = mapped.filter((item) => item.status === "overdue");
  const upcoming7Days = mapped.filter((item) => {
    const date = parseISO(item.expectedDate);
    return item.status === "pending" && !isBefore(date, now) && !isAfter(date, in7);
  });
  const upcoming30Days = mapped.filter((item) => {
    const date = parseISO(item.expectedDate);
    return item.status === "pending" && !isBefore(date, now) && !isAfter(date, in30);
  });
  const subscriptionsEndingSoon = endingProjects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    clientName: project.client.name,
    monthlyFeeUsd: requireNumber(project.monthlyFeeUsd),
    endDate: dateOnly(project.monthlyFeeEndDate!),
    daysRemaining: differenceInCalendarDays(project.monthlyFeeEndDate!, now),
  }));

  return {
    overdue: {
      count: overdue.length,
      totalUsd: overdue.reduce((sum, item) => sum + item.expectedAmountUsd, 0),
      items: overdue,
    },
    upcoming7Days: {
      count: upcoming7Days.length,
      totalUsd: upcoming7Days.reduce((sum, item) => sum + item.expectedAmountUsd, 0),
      items: upcoming7Days.slice(0, 7),
    },
    upcoming30Days: {
      count: upcoming30Days.length,
      totalUsd: upcoming30Days.reduce((sum, item) => sum + item.expectedAmountUsd, 0),
      items: upcoming30Days,
    },
    subscriptionsEndingSoon: {
      count: subscriptionsEndingSoon.length,
      items: subscriptionsEndingSoon,
    },
  };
}

export async function getAlerts(): Promise<AlertsPayload> {
  if (!hasDatabaseConfig()) {
    return demoAlerts;
  }

  return getAlertsFromDatabase();
}

function bucketMonthLabel(date: string | Date) {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return format(parsed, "MMM yy");
}

function bucketMonthKey(date: string | Date) {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return format(parsed, "yyyy-MM");
}

type DashboardProjectAggregate = {
  clientName: string;
  status: ProjectStatus | string;
  incomes: Array<{ status: IncomeStatus | string }>;
  scheduledPayments: Array<{ status: ScheduledPaymentStatus | string }>;
};

function buildDashboardPayload({
  alerts,
  allExpenses,
  allIncomes,
  committedExpensesMonthUsd,
  expenses,
  filters,
  incomes,
  layers,
  operationalPendingIncomes,
  payments,
  projects,
  salariesThisMonthUsd,
}: {
  alerts: AlertsPayload;
  allExpenses: Array<{ amountUsd: number }>;
  allIncomes: Array<{ amountUsd: number }>;
  committedExpensesMonthUsd: number;
  expenses: DashboardExpenseRow[];
  filters?: z.infer<typeof dashboardFilterSchema>;
  incomes: DashboardIncomeRow[];
  layers: DistributionRecord[];
  operationalPendingIncomes: Array<{ amountUsd: number }>;
  payments: ScheduledPaymentRecord[];
  projects: DashboardProjectAggregate[];
  salariesThisMonthUsd: number;
}): DashboardPayload {
  const summary = computeDistributionSummary(
    allIncomes.map((item) => ({ amountUsd: item.amountUsd })),
    allExpenses.map((item) => ({ amountUsd: item.amountUsd })),
    layers.map((item) => ({ currentAmountUsd: item.currentAmountUsd })),
  );

  const monthlyMap = new Map<string, { month: string; monthKey: string; incomeUsd: number; expenseUsd: number; netUsd: number }>();
  for (const income of incomes) {
    const monthKey = bucketMonthKey(income.date);
    const bucket = monthlyMap.get(monthKey) ?? {
      month: bucketMonthLabel(income.date),
      monthKey,
      incomeUsd: 0,
      expenseUsd: 0,
      netUsd: 0,
    };
    bucket.incomeUsd += income.amountUsd;
    bucket.netUsd += income.amountUsd;
    monthlyMap.set(monthKey, bucket);
  }

  for (const expense of expenses) {
    const monthKey = bucketMonthKey(expense.date);
    const bucket = monthlyMap.get(monthKey) ?? {
      month: bucketMonthLabel(expense.date),
      monthKey,
      incomeUsd: 0,
      expenseUsd: 0,
      netUsd: 0,
    };
    bucket.expenseUsd += expense.amountUsd;
    bucket.netUsd -= expense.amountUsd;
    monthlyMap.set(monthKey, bucket);
  }

  const monthlyPerformance = Array.from(monthlyMap.values())
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .map(({ monthKey: _, ...item }) => item);

  let cumulative = 0;
  const cumulativeCashflow = monthlyPerformance.map((item) => {
    cumulative += item.netUsd;
    return {
      month: item.month,
      valueUsd: cumulative,
    };
  });

  const categoryBreakdown = Array.from(
    expenses.reduce((acc, item) => {
      acc.set(item.categoryName, (acc.get(item.categoryName) ?? 0) + item.amountUsd);
      return acc;
    }, new Map<string, number>()),
  )
    .map(([category, amountUsd]) => ({ category, amountUsd }))
    .sort((left, right) => right.amountUsd - left.amountUsd);

  const topClientsMap = projects.reduce(
    (acc, project) => {
      const current = acc.get(project.clientName) ?? {
        clientName: project.clientName,
        incomeUsd: 0,
        activeProjects: 0,
        pendingPayments: 0,
      };
      current.activeProjects += isActiveProjectStatus(project.status) ? 1 : 0;
      current.pendingPayments += project.scheduledPayments.filter((payment) => isOpenScheduledStatus(payment.status as ScheduledPaymentStatus)).length;
      current.pendingPayments += project.incomes.filter((income) => isPendingIncomeStatus(income.status)).length;
      acc.set(project.clientName, current);
      return acc;
    },
    new Map<string, { clientName: string; incomeUsd: number; activeProjects: number; pendingPayments: number }>(),
  );

  for (const income of incomes) {
    const current = topClientsMap.get(income.clientName) ?? {
      clientName: income.clientName,
      incomeUsd: 0,
      activeProjects: 0,
      pendingPayments: 0,
    };
    current.incomeUsd += income.amountUsd;
    topClientsMap.set(income.clientName, current);
  }

  const currentMonthEnd = endOfMonth(new Date());
  const receivableUsd =
    payments
      .filter(
        (payment) =>
          isOpenScheduledStatus(payment.status as ScheduledPaymentStatus) &&
          !isAfter(parseISO(payment.expectedDate), currentMonthEnd),
      )
      .reduce((sum, item) => sum + item.expectedAmountUsd, 0) +
    operationalPendingIncomes.reduce((sum, item) => sum + item.amountUsd, 0);

  return {
    filters: {
      from: filters?.from ?? null,
      to: filters?.to ?? null,
      clientId: filters?.clientId ?? null,
      projectId: filters?.projectId ?? null,
    },
    kpis: {
      incomesUsd: incomes.reduce((sum, item) => sum + item.amountUsd, 0),
      expensesUsd: expenses.reduce((sum, item) => sum + item.amountUsd, 0),
      netUsd: incomes.reduce((sum, item) => sum + item.amountUsd, 0) - expenses.reduce((sum, item) => sum + item.amountUsd, 0),
      remanenteUsd: summary.remanenteUsd,
      receivableUsd,
      overdueUsd: payments
        .filter((payment) => payment.status === "overdue")
        .reduce((sum, item) => sum + item.expectedAmountUsd, 0),
      committedExpensesMonthUsd,
      salariesThisMonthUsd,
    },
    charts: {
      monthlyPerformance,
      categoryBreakdown,
      cumulativeCashflow,
      topClients: Array.from(topClientsMap.values()).sort((a, b) => b.incomeUsd - a.incomeUsd).slice(0, 5),
    },
    upcomingPayments: payments.filter((payment) => isOpenScheduledStatus(payment.status as ScheduledPaymentStatus)).slice(0, 10),
    distribution: layers,
    alerts,
  };
}

async function getDashboardFromDatabase(filters: z.infer<typeof dashboardFilterSchema>): Promise<DashboardPayload> {
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  await syncProjectSubscriptions(prisma);
  await syncOverduePayments(prisma);
  await syncOpenRecurringExpenses(prisma);

  const incomeWhere: Prisma.IncomeWhereInput = {
    status: IncomeStatus.PAID,
    date: {
      gte: filters?.from ? parseISO(filters.from) : undefined,
      lte: filters?.to ? parseISO(filters.to) : undefined,
    },
    projectId: filters?.projectId ?? undefined,
    project: filters?.clientId ? { clientId: filters.clientId } : undefined,
  };

  const operationalPendingIncomeWhere: Prisma.IncomeWhereInput = {
    status: IncomeStatus.PENDING,
    date: {
      lte: currentMonthEnd,
    },
    projectId: filters?.projectId ?? undefined,
    project: filters?.clientId ? { clientId: filters.clientId } : undefined,
  };

  const expenseWhere: Prisma.ExpenseWhereInput = {
    date: {
      gte: filters?.from ? parseISO(filters.from) : undefined,
      lte: filters?.to ? parseISO(filters.to) : undefined,
    },
    projectId: filters?.projectId ?? undefined,
    project: filters?.clientId ? { clientId: filters.clientId } : undefined,
  };

  const paymentWhere: Prisma.ScheduledPaymentWhereInput = {
    projectId: filters?.projectId ?? undefined,
    project: filters?.clientId ? { clientId: filters.clientId } : undefined,
  };

  const [incomes, operationalPendingIncomes, expenses, payments, committedExpensesMonth, layers, allIncomes, allExpenses, salaries, projects, alerts] = await Promise.all([
    prisma.income.findMany({
      where: incomeWhere,
      select: {
        amountUsd: true,
        date: true,
        project: {
          select: {
            client: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.income.findMany({
      where: operationalPendingIncomeWhere,
      select: { amountUsd: true },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: {
        amountUsd: true,
        date: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.scheduledPayment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        projectId: true,
        type: true,
        expectedDate: true,
        expectedAmountUsd: true,
        status: true,
        paidAt: true,
        actualIncomeId: true,
        notes: true,
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { expectedDate: "asc" },
    }),
    prisma.scheduledExpense.findMany({
      where: {
        status: ScheduledExpenseStatus.PENDING,
        dueDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      select: {
        amountUsd: true,
      },
    }),
    prisma.distributionConfig.findMany({ orderBy: { layer: "asc" } }),
    prisma.income.findMany({ where: { status: IncomeStatus.PAID }, select: { amountUsd: true } }),
    prisma.expense.findMany({ select: { amountUsd: true } }),
    prisma.salaryWithdrawal.findMany({
      where: { month: currentMonthStart },
      select: { amountUsd: true },
    }),
    prisma.project.findMany({
      where: {
        id: filters?.projectId ?? undefined,
        clientId: filters?.clientId ?? undefined,
      },
      select: {
        status: true,
        client: {
          select: {
            name: true,
          },
        },
        incomes: {
          select: {
            status: true,
          },
        },
        scheduledPayments: {
          select: {
            status: true,
          },
        },
      },
    }),
    getAlertsFromDatabase({ skipSync: true }),
  ]);

  return buildDashboardPayload({
    filters,
    incomes: incomes.map((income) => ({
      amountUsd: requireNumber(income.amountUsd),
      date: dateOnly(income.date),
      clientName: income.project.client.name,
    })),
    expenses: expenses.map((expense) => ({
      amountUsd: requireNumber(expense.amountUsd),
      date: dateOnly(expense.date),
      categoryName: expense.category.name,
    })),
    payments: payments.map(mapScheduledPaymentRecord),
    operationalPendingIncomes: operationalPendingIncomes.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
    committedExpensesMonthUsd: committedExpensesMonth.reduce((sum, item) => sum + requireNumber(item.amountUsd), 0),
    layers: layers.map(mapDistributionRecord),
    allIncomes: allIncomes.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
    allExpenses: allExpenses.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
    salariesThisMonthUsd: salaries.reduce((sum, item) => sum + requireNumber(item.amountUsd), 0),
    projects: projects.map((project) => ({
      clientName: project.client.name,
      status: project.status,
      incomes: project.incomes.map((income) => ({ status: income.status })),
      scheduledPayments: project.scheduledPayments.map((payment) => ({ status: payment.status })),
    })),
    alerts,
  });
}

const getCachedDashboard = unstable_cache(
  async (serializedFilters: string) => {
    const filters = dashboardFilterSchema.parse(JSON.parse(serializedFilters));
    return getDashboardFromDatabase(filters);
  },
  ["dashboard-payload"],
  {
    tags: [dashboardTag],
    revalidate: 300,
  },
);

export async function getDashboard(filters?: z.infer<typeof dashboardFilterSchema>): Promise<DashboardPayload> {
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  if (!hasDatabaseConfig()) {
    const demoProjectsScope = demoProjects.filter((project) => {
      if (filters?.projectId && project.id !== filters.projectId) {
        return false;
      }

      if (filters?.clientId && project.clientId !== filters.clientId) {
        return false;
      }

      return true;
    });

    return buildDashboardPayload({
      filters,
      incomes: mapDemoIncomes({
        projectId: filters?.projectId ?? null,
        clientId: filters?.clientId ?? null,
        status: "PAID",
        from: filters?.from ?? null,
        to: filters?.to ?? null,
      }),
      expenses: mapDemoExpenses({
        projectId: filters?.projectId ?? null,
        from: filters?.from ?? null,
        to: filters?.to ?? null,
      }),
      payments: mapDemoScheduledPayments({
        projectId: filters?.projectId ?? null,
        clientId: filters?.clientId ?? null,
      }),
      operationalPendingIncomes: mapDemoIncomes({
        projectId: filters?.projectId ?? null,
        clientId: filters?.clientId ?? null,
        status: "PENDING",
        to: dateOnly(currentMonthEnd),
      }).map((item) => ({ amountUsd: item.amountUsd })),
      committedExpensesMonthUsd: mapDemoScheduledExpenses({
        status: "PENDING",
        currentMonth: true,
        includeOverdue: true,
      }).reduce((sum, item) => sum + requireNumber(item.amountUsd), 0),
      layers: demoLayers,
      allIncomes: demoIncomes.filter((item) => item.status === "PAID").map((item) => ({ amountUsd: item.amountUsd })),
      allExpenses: demoExpenses.map((item) => ({ amountUsd: item.amountUsd })),
      salariesThisMonthUsd: demoSalaries
        .filter((item) => item.month === dateOnly(currentMonthStart))
        .reduce((sum, item) => sum + item.amountUsd, 0),
      projects: demoProjectsScope.map((project) => ({
        clientName: project.clientName,
        status: project.status,
        incomes: demoIncomes.filter((income) => income.projectId === project.id).map((income) => ({
          amountUsd: income.amountUsd,
          date: income.date,
          status: income.status,
        })),
        scheduledPayments: demoScheduledPayments
          .filter((payment) => payment.projectId === project.id)
          .map((payment) => ({
            expectedDate: payment.expectedDate,
            status: payment.status,
          })),
      })),
      alerts: demoAlerts,
    });
  }

  const normalizedFilters = dashboardFilterSchema.parse(filters ?? {});
  return getCachedDashboard(JSON.stringify(normalizedFilters));
}
