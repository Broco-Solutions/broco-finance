import {
  ContractFrequency,
  DistributionLayer,
  ExpenseType,
  IncomeType,
  Prisma,
  ProjectStatus,
  ScheduledPaymentStatus,
  type PrismaClient,
} from "@prisma/client";
import { addDays, addMonths, format, isAfter, isBefore, parseISO, startOfDay, startOfMonth } from "date-fns";
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
  RecurringContractRecord,
  SalaryRecord,
  ScheduledPaymentRecord,
} from "@/lib/types";
import {
  demoAlerts,
  demoCategories,
  demoClientDetails,
  demoClients,
  demoDashboard,
  demoDistributionPage,
  demoExpenses,
  demoIncomes,
  demoLayers,
  demoProjectDetails,
  demoProjects,
  demoRecurringContracts,
  demoSalaries,
  demoScheduledPayments,
} from "@/server/demo-data";
import { AppError } from "@/server/errors";
import { hasDatabaseConfig, prisma } from "@/server/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const salaryCategoryName = "Sueldos/Honorarios";

function isOpenScheduledStatus(status: ScheduledPaymentStatus) {
  return status === ScheduledPaymentStatus.pending || status === ScheduledPaymentStatus.overdue;
}

const projectStatusSchema = z.enum(["active", "finished", "cancelled"]);
const incomeTypeSchema = z.enum(["advance", "final_payment", "recurring"]);
const expenseTypeSchema = z.enum(["fixed", "variable"]);
const contractFrequencySchema = z.enum(["monthly", "quarterly", "biannual", "annual"]);
const scheduledActionSchema = z.enum(["mark_paid", "cancel", "edit"]);

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
  name: z.string().min(2, "El nombre es obligatorio."),
  notes: z.string().trim().nullable().optional(),
});

export const projectInputSchema = z.object({
  clientId: z.string().uuid("Cliente inválido."),
  name: z.string().min(2, "El nombre es obligatorio."),
  status: projectStatusSchema.default("active"),
  totalBudgetUsd: z.coerce.number().nonnegative().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const incomeInputSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido."),
  date: z.string().min(8, "Fecha inválida."),
  type: incomeTypeSchema,
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

export const recurringInputSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido."),
  description: z.string().min(2, "La descripción es obligatoria."),
  frequency: contractFrequencySchema,
  startDate: z.string().min(8, "Fecha inválida."),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().nullable().optional(),
  updatePendingPayments: z.boolean().optional(),
}).merge(baseMoneySchema);

export const scheduledPaymentInputSchema = z.object({
  action: scheduledActionSchema,
  expectedDate: z.string().nullable().optional(),
  expectedAmountUsd: z.coerce.number().nonnegative().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  incomeId: z.string().uuid().nullable().optional(),
  createIncome: incomeInputSchema.nullable().optional(),
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

export const recurringFilterSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  active: z.enum(["true", "false"]).nullable().optional(),
});

export const scheduledFilterSchema = z.object({
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

export const incomeFilterSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  type: z.enum(["advance", "final_payment", "recurring"]).nullable().optional(),
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

function requireDatabase() {
  if (!hasDatabaseConfig()) {
    throw new AppError("Configurá DATABASE_URL para habilitar cambios persistentes.", 503);
  }
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

function buildPaymentSchedule(startDate: Date, endDate: Date | null, frequency: ContractFrequency) {
  const dates: Date[] = [];
  const limitDate = endDate ?? addMonths(startOfMonth(new Date()), 12);
  let cursor = startOfDay(startDate);

  while (!isAfter(cursor, limitDate)) {
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

async function syncOpenEndedContracts(db: DbClient) {
  const contracts = await db.recurringContract.findMany({
    where: {
      isActive: true,
      endDate: null,
    },
  });

  for (const contract of contracts) {
    await syncScheduledPayments(db, contract, false);
  }
}

async function clearPendingScheduledPayments(db: DbClient, contractId: string) {
  await db.scheduledPayment.deleteMany({
    where: {
      recurringContractId: contractId,
      status: ScheduledPaymentStatus.pending,
    },
  });
}

async function syncScheduledPayments(
  db: DbClient,
  contract: {
    id: string;
    projectId: string;
    amountUsd: Prisma.Decimal;
    frequency: ContractFrequency;
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
  },
  updatePendingPayments: boolean,
) {
  if (!contract.isActive) {
    return;
  }

  const dates = buildPaymentSchedule(contract.startDate, contract.endDate, contract.frequency);
  const existing = await db.scheduledPayment.findMany({
    where: { recurringContractId: contract.id },
  });

  const existingKeys = new Set(existing.map((payment) => dateOnly(payment.expectedDate)));
  const amountUsd = requireNumber(contract.amountUsd);

  await Promise.all(
    dates
      .filter((date) => !existingKeys.has(dateOnly(date)))
      .map((expectedDate) =>
        db.scheduledPayment.create({
          data: {
            recurringContractId: contract.id,
            projectId: contract.projectId,
            expectedDate,
            expectedAmountUsd: amountUsd,
            status: ScheduledPaymentStatus.pending,
          },
        }),
      ),
  );

  if (updatePendingPayments) {
    await db.scheduledPayment.updateMany({
      where: {
        recurringContractId: contract.id,
        status: ScheduledPaymentStatus.pending,
        expectedDate: {
          gte: startOfDay(new Date()),
        },
      },
      data: {
        expectedAmountUsd: amountUsd,
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
  return query ? demoClients.filter((client) => client.name.toLowerCase().includes(query)) : demoClients;
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
      if (filters?.type && income.type !== filters.type) {
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

function mapClientRecord(client: Prisma.ClientGetPayload<{ include: { projects: { include: { incomes: true; scheduledPayments: true } } } }>): ClientRecord {
  const totalInvoicedUsd = client.projects.flatMap((project) => project.incomes).reduce((sum, income) => sum + requireNumber(income.amountUsd), 0);
  const pendingPayments = client.projects
    .flatMap((project) => project.scheduledPayments)
    .filter((payment) => isOpenScheduledStatus(payment.status));

  return {
    id: client.id,
    name: client.name,
    notes: client.notes,
    totalInvoicedUsd,
    totalReceivableUsd: pendingPayments.reduce((sum, payment) => sum + requireNumber(payment.expectedAmountUsd), 0),
    activeProjects: client.projects.filter((project) => project.status === ProjectStatus.active).length,
    totalProjects: client.projects.length,
  };
}

function mapProjectRecord(
  project: Prisma.ProjectGetPayload<{
    include: {
      client: true;
      incomes: true;
      scheduledPayments: true;
    };
  }>,
): ProjectRecord {
  const nextPayment = project.scheduledPayments
    .filter((payment) => isOpenScheduledStatus(payment.status))
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime())[0];

  return {
    id: project.id,
    clientId: project.clientId,
    clientName: project.client.name,
    name: project.name,
    status: project.status,
    totalBudgetUsd: toNumber(project.totalBudgetUsd),
    notes: project.notes,
    totalCollectedUsd: project.incomes.reduce((sum, income) => sum + requireNumber(income.amountUsd), 0),
    nextPaymentDate: nextPayment ? dateOnly(nextPayment.expectedDate) : null,
  };
}

function mapIncomeRecord(
  income: Prisma.IncomeGetPayload<{
    include: { project: { include: { client: true } } };
  }>,
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
  expense: Prisma.ExpenseGetPayload<{
    include: {
      category: true;
      project: true;
    };
  }>,
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
  record: Prisma.ScheduledPaymentGetPayload<{
    include: { project: { include: { client: true } } };
  }>,
): ScheduledPaymentRecord {
  return {
    id: record.id,
    recurringContractId: record.recurringContractId,
    projectId: record.projectId,
    projectName: record.project.name,
    clientName: record.project.client.name,
    expectedDate: dateOnly(record.expectedDate),
    expectedAmountUsd: requireNumber(record.expectedAmountUsd),
    status: record.status,
    paidAt: record.paidAt ? dateOnly(record.paidAt) : null,
    actualIncomeId: record.actualIncomeId,
    notes: record.notes,
  };
}

function mapRecurringRecord(
  record: Prisma.RecurringContractGetPayload<{
    include: {
      project: { include: { client: true } };
      payments: true;
    };
  }>,
): RecurringContractRecord {
  const nextDue = record.payments
    .filter((payment) => isOpenScheduledStatus(payment.status))
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime())[0];

  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.project.name,
    clientName: record.project.client.name,
    description: record.description,
    amountUsd: requireNumber(record.amountUsd),
    amountArs: toNumber(record.amountArs),
    exchangeRate: null,
    frequency: record.frequency,
    startDate: dateOnly(record.startDate),
    endDate: record.endDate ? dateOnly(record.endDate) : null,
    isActive: record.isActive,
    notes: record.notes,
    nextDueDate: nextDue ? dateOnly(nextDue.expectedDate) : null,
  };
}

export async function listClients(search?: string | null) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoClients(search), demoMode: true };
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const clients = await prisma.client.findMany({
    where: search
      ? {
          name: {
            contains: search,
            mode: "insensitive",
          },
        }
      : undefined,
    include: {
      projects: {
        include: {
          incomes: true,
          scheduledPayments: true,
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
    return detail;
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        include: {
          client: true,
          incomes: true,
          scheduledPayments: true,
        },
      },
    },
  });

  if (!client) {
    throw new AppError("Cliente no encontrado.", 404);
  }

  const projects = client.projects.map(mapProjectRecord);

  const incomes = await prisma.income.findMany({
    where: { project: { clientId: id } },
    include: {
      project: { include: { client: true } },
    },
    orderBy: { date: "desc" },
    take: 12,
  });

  const payments = await prisma.scheduledPayment.findMany({
    where: {
      project: { clientId: id },
      status: {
        in: [ScheduledPaymentStatus.pending, ScheduledPaymentStatus.overdue],
      },
    },
    include: {
      project: { include: { client: true } },
    },
    orderBy: { expectedDate: "asc" },
    take: 12,
  });

  return {
    client: mapClientRecord({
      ...client,
      projects: client.projects.map((project) => ({
        ...project,
        incomes: project.incomes,
        scheduledPayments: project.scheduledPayments,
      })),
    }),
    projects,
    incomes: incomes.map(mapIncomeRecord),
    payments: payments.map(mapScheduledPaymentRecord),
  };
}

export async function createClient(input: z.infer<typeof clientInputSchema>) {
  requireDatabase();

  return prisma.client.create({
    data: {
      name: input.name.trim(),
      notes: input.notes ?? null,
    },
  });
}

export async function updateClient(id: string, input: z.infer<typeof clientInputSchema>) {
  requireDatabase();

  return prisma.client.update({
    where: { id },
    data: {
      name: input.name.trim(),
      notes: input.notes ?? null,
    },
  });
}

export async function deleteClient(id: string) {
  requireDatabase();

  const projectCount = await prisma.project.count({ where: { clientId: id } });

  if (projectCount > 0) {
    throw new AppError("No podés eliminar un cliente con proyectos asociados.", 409);
  }

  await prisma.client.delete({ where: { id } });
}

export async function listProjects(filters?: { clientId?: string | null; status?: string | null }) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoProjects(filters), demoMode: true };
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const projects = await prisma.project.findMany({
    where: {
      clientId: filters?.clientId ?? undefined,
      status: (filters?.status as ProjectStatus | undefined) ?? undefined,
    },
    include: {
      client: true,
      incomes: true,
      scheduledPayments: true,
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
    return detail;
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      incomes: {
        include: { project: { include: { client: true } } },
        orderBy: { date: "desc" },
      },
      recurring: {
        include: {
          project: { include: { client: true } },
          payments: true,
        },
      },
      scheduledPayments: {
        include: { project: { include: { client: true } } },
        orderBy: { expectedDate: "asc" },
      },
      expenses: {
        include: {
          category: true,
          project: true,
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
    incomes: project.incomes.map(mapIncomeRecord),
    recurringContracts: project.recurring.map(mapRecurringRecord),
    scheduledPayments: project.scheduledPayments.map(mapScheduledPaymentRecord),
    expenses: project.expenses.map(mapExpenseRecord),
  };
}

export async function createProject(input: z.infer<typeof projectInputSchema>) {
  requireDatabase();

  return prisma.project.create({
    data: {
      clientId: input.clientId,
      name: input.name.trim(),
      status: input.status as ProjectStatus,
      totalBudgetUsd:
        typeof input.totalBudgetUsd === "number" ? new Prisma.Decimal(input.totalBudgetUsd.toFixed(2)) : null,
      notes: input.notes ?? null,
    },
  });
}

export async function updateProject(id: string, input: z.infer<typeof projectInputSchema>) {
  requireDatabase();

  return prisma.project.update({
    where: { id },
    data: {
      clientId: input.clientId,
      name: input.name.trim(),
      status: input.status as ProjectStatus,
      totalBudgetUsd:
        typeof input.totalBudgetUsd === "number" ? new Prisma.Decimal(input.totalBudgetUsd.toFixed(2)) : null,
      notes: input.notes ?? null,
    },
  });
}

export async function deleteProject(id: string) {
  requireDatabase();

  const [incomeCount, expenseCount, recurringCount] = await Promise.all([
    prisma.income.count({ where: { projectId: id } }),
    prisma.expense.count({ where: { projectId: id } }),
    prisma.recurringContract.count({ where: { projectId: id } }),
  ]);

  if (incomeCount + expenseCount + recurringCount > 0) {
    throw new AppError("No podés eliminar un proyecto con movimientos asociados.", 409);
  }

  await prisma.project.delete({ where: { id } });
}

export async function listIncomes(filters?: z.infer<typeof incomeFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoIncomes(filters), demoMode: true };
  }

  const items = await prisma.income.findMany({
    where: {
      projectId: filters?.projectId ?? undefined,
      type: (filters?.type as IncomeType | undefined) ?? undefined,
      project: filters?.clientId ? { clientId: filters.clientId } : undefined,
      date: {
        gte: filters?.from ? parseISO(filters.from) : undefined,
        lte: filters?.to ? parseISO(filters.to) : undefined,
      },
    },
    include: {
      project: { include: { client: true } },
    },
    orderBy: { date: "desc" },
  });

  return { data: items.map(mapIncomeRecord), demoMode: false };
}

export async function createIncome(input: z.infer<typeof incomeInputSchema>) {
  requireDatabase();
  const money = normalizeMoney(input);

  return prisma.income.create({
    data: {
      projectId: input.projectId,
      date: parseISO(input.date),
      type: input.type as IncomeType,
      notes: input.notes ?? null,
      ...money,
    },
  });
}

export async function updateIncome(id: string, input: z.infer<typeof incomeInputSchema>) {
  requireDatabase();
  const money = normalizeMoney(input);

  return prisma.income.update({
    where: { id },
    data: {
      projectId: input.projectId,
      date: parseISO(input.date),
      type: input.type as IncomeType,
      notes: input.notes ?? null,
      ...money,
    },
  });
}

export async function deleteIncome(id: string) {
  requireDatabase();

  const payment = await prisma.scheduledPayment.findUnique({
    where: { actualIncomeId: id },
  });

  if (payment) {
    throw new AppError("No podés eliminar un ingreso conciliado con un pago programado.", 409);
  }

  await prisma.income.delete({ where: { id } });
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

  return prisma.expenseCategory.create({
    data: {
      name: input.name.trim(),
      isDefault: false,
    },
  });
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
    include: {
      category: true,
      project: true,
    },
    orderBy: { date: "desc" },
  });

  return { data: items.map(mapExpenseRecord), demoMode: false };
}

export async function createExpense(input: z.infer<typeof expenseInputSchema>) {
  requireDatabase();
  const money = normalizeMoney(input);

  return prisma.expense.create({
    data: {
      date: parseISO(input.date),
      categoryId: input.categoryId,
      expenseType: input.expenseType as ExpenseType,
      projectId: input.projectId ?? null,
      description: input.description.trim(),
      notes: input.notes ?? null,
      ...money,
    },
  });
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

  const money = normalizeMoney(input);

  return prisma.expense.update({
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
  });
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

  await prisma.expense.delete({ where: { id } });
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
    prisma.income.findMany({ select: { amountUsd: true } }),
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

  await Promise.all(
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
  );
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

  return prisma.$transaction(async (tx) => {
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
  });
}

export async function deleteSalary(id: string) {
  requireDatabase();
  await prisma.salaryWithdrawal.delete({ where: { id } });
}

export async function listRecurring(filters?: z.infer<typeof recurringFilterSchema>) {
  if (!hasDatabaseConfig()) {
    let contracts = demoRecurringContracts;
    if (filters?.clientId) {
      contracts = contracts.filter((item) => demoProjects.find((project) => project.id === item.projectId)?.clientId === filters.clientId);
    }
    if (filters?.projectId) {
      contracts = contracts.filter((item) => item.projectId === filters.projectId);
    }
    if (filters?.active) {
      const active = filters.active === "true";
      contracts = contracts.filter((item) => item.isActive === active);
    }
    return { data: contracts, demoMode: true };
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const contracts = await prisma.recurringContract.findMany({
    where: {
      projectId: filters?.projectId ?? undefined,
      isActive: filters?.active ? filters.active === "true" : undefined,
      project: filters?.clientId ? { clientId: filters.clientId } : undefined,
    },
    include: {
      project: { include: { client: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: contracts.map(mapRecurringRecord), demoMode: false };
}

export async function createRecurring(input: z.infer<typeof recurringInputSchema>) {
  requireDatabase();

  return prisma.$transaction(async (tx) => {
    const money = normalizeMoney(input);
    const contract = await tx.recurringContract.create({
      data: {
        projectId: input.projectId,
        description: input.description.trim(),
        frequency: input.frequency as ContractFrequency,
        startDate: parseISO(input.startDate),
        endDate: input.endDate ? parseISO(input.endDate) : null,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
        amountUsd: money.amountUsd,
        amountArs: money.amountArs,
      },
    });

    if (contract.isActive) {
      await syncScheduledPayments(tx, contract, true);
    }

    return contract;
  });
}

export async function updateRecurring(id: string, input: z.infer<typeof recurringInputSchema>) {
  requireDatabase();

  return prisma.$transaction(async (tx) => {
    const money = normalizeMoney(input);
    const contract = await tx.recurringContract.update({
      where: { id },
      data: {
        projectId: input.projectId,
        description: input.description.trim(),
        frequency: input.frequency as ContractFrequency,
        startDate: parseISO(input.startDate),
        endDate: input.endDate ? parseISO(input.endDate) : null,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
        amountUsd: money.amountUsd,
        amountArs: money.amountArs,
      },
    });

    if (!contract.isActive) {
      await clearPendingScheduledPayments(tx, contract.id);
      return contract;
    }

    await syncScheduledPayments(tx, contract, input.updatePendingPayments ?? true);
    return contract;
  });
}

export async function listScheduledPayments(filters?: z.infer<typeof scheduledFilterSchema>) {
  if (!hasDatabaseConfig()) {
    return { data: mapDemoScheduledPayments(filters), demoMode: true };
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const items = await prisma.scheduledPayment.findMany({
    where: {
      status: (filters?.status as ScheduledPaymentStatus | undefined) ?? undefined,
      projectId: filters?.projectId ?? undefined,
      project: filters?.clientId ? { clientId: filters.clientId } : undefined,
      expectedDate: {
        gte: filters?.from ? parseISO(filters.from) : undefined,
        lte: filters?.to ? parseISO(filters.to) : undefined,
      },
    },
    include: {
      project: { include: { client: true } },
    },
    orderBy: { expectedDate: "asc" },
  });

  return { data: items.map(mapScheduledPaymentRecord), demoMode: false };
}

export async function updateScheduledPayment(id: string, input: z.infer<typeof scheduledPaymentInputSchema>) {
  requireDatabase();

  return prisma.$transaction(async (tx) => {
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

    if (!incomeId && input.createIncome) {
      const money = normalizeMoney(input.createIncome);
      const createdIncome = await tx.income.create({
        data: {
          projectId: input.createIncome.projectId,
          date: parseISO(input.createIncome.date),
          type: input.createIncome.type as IncomeType,
          notes: input.createIncome.notes ?? null,
          ...money,
        },
      });
      incomeId = createdIncome.id;
    }

    if (!incomeId) {
      const createdIncome = await tx.income.create({
        data: {
          projectId: payment.projectId,
          date: paidAt,
          type: payment.recurringContractId ? IncomeType.recurring : IncomeType.final_payment,
          notes: input.notes ?? payment.notes ?? "Cobro registrado desde pago programado.",
          amountUsd: payment.expectedAmountUsd,
          amountArs: null,
          exchangeRate: null,
        },
      });
      incomeId = createdIncome.id;
    }

    if (!incomeId) {
      throw new AppError("Seleccioná o creá un ingreso para marcar como cobrado.", 422);
    }

    return tx.scheduledPayment.update({
      where: { id },
      data: {
        status: ScheduledPaymentStatus.paid,
        paidAt,
        actualIncomeId: incomeId,
        notes: input.notes ?? payment.notes,
      },
    });
  });
}

export async function getAlerts(): Promise<AlertsPayload> {
  if (!hasDatabaseConfig()) {
    return demoAlerts;
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

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
    include: {
      project: { include: { client: true } },
    },
    orderBy: { expectedDate: "asc" },
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
  };
}

function bucketMonthLabel(date: string | Date) {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return format(parsed, "MMM");
}

export async function getDashboard(filters?: z.infer<typeof dashboardFilterSchema>): Promise<DashboardPayload> {
  if (!hasDatabaseConfig()) {
    return {
      ...demoDashboard,
      filters: {
        from: filters?.from ?? null,
        to: filters?.to ?? null,
        clientId: filters?.clientId ?? null,
        projectId: filters?.projectId ?? null,
      },
    };
  }

  await syncOpenEndedContracts(prisma);
  await syncOverduePayments(prisma);

  const incomeWhere: Prisma.IncomeWhereInput = {
    date: {
      gte: filters?.from ? parseISO(filters.from) : undefined,
      lte: filters?.to ? parseISO(filters.to) : undefined,
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

  const [incomes, expenses, payments, layers, allIncomes, allExpenses, salaries, projects] = await Promise.all([
    prisma.income.findMany({
      where: incomeWhere,
      include: { project: { include: { client: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      include: { category: true, project: true },
      orderBy: { date: "asc" },
    }),
    prisma.scheduledPayment.findMany({
      where: paymentWhere,
      include: { project: { include: { client: true } } },
      orderBy: { expectedDate: "asc" },
    }),
    prisma.distributionConfig.findMany({ orderBy: { layer: "asc" } }),
    prisma.income.findMany({ select: { amountUsd: true } }),
    prisma.expense.findMany({ select: { amountUsd: true } }),
    prisma.salaryWithdrawal.findMany({
      where: {
        month: startOfMonth(new Date()),
      },
    }),
    prisma.project.findMany({
      include: {
        client: true,
        incomes: true,
        scheduledPayments: true,
      },
    }),
  ]);

  const mappedIncomes = incomes.map(mapIncomeRecord);
  const mappedExpenses = expenses.map(mapExpenseRecord);
  const mappedPayments = payments.map(mapScheduledPaymentRecord);
  const summary = computeDistributionSummary(
    allIncomes.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
    allExpenses.map((item) => ({ amountUsd: requireNumber(item.amountUsd) })),
    layers.map((item) => ({ currentAmountUsd: requireNumber(item.currentAmountUsd) })),
  );

  const monthlyMap = new Map<string, { month: string; incomeUsd: number; expenseUsd: number; netUsd: number }>();
  for (const income of mappedIncomes) {
    const key = bucketMonthLabel(income.date);
    const bucket = monthlyMap.get(key) ?? { month: key, incomeUsd: 0, expenseUsd: 0, netUsd: 0 };
    bucket.incomeUsd += income.amountUsd;
    bucket.netUsd += income.amountUsd;
    monthlyMap.set(key, bucket);
  }
  for (const expense of mappedExpenses) {
    const key = bucketMonthLabel(expense.date);
    const bucket = monthlyMap.get(key) ?? { month: key, incomeUsd: 0, expenseUsd: 0, netUsd: 0 };
    bucket.expenseUsd += expense.amountUsd;
    bucket.netUsd -= expense.amountUsd;
    monthlyMap.set(key, bucket);
  }

  let cumulative = 0;
  const monthlyPerformance = Array.from(monthlyMap.values());
  const cumulativeCashflow = monthlyPerformance.map((item) => {
    cumulative += item.netUsd;
    return {
      month: item.month,
      valueUsd: cumulative,
    };
  });

  const categoryBreakdown = Array.from(
    mappedExpenses.reduce((acc, item) => {
      acc.set(item.categoryName, (acc.get(item.categoryName) ?? 0) + item.amountUsd);
      return acc;
    }, new Map<string, number>()),
  ).map(([category, amountUsd]) => ({ category, amountUsd }));

  const topClients = projects
    .reduce(
      (acc, project) => {
        const current = acc.get(project.client.name) ?? {
          clientName: project.client.name,
          incomeUsd: 0,
          activeProjects: 0,
          pendingPayments: 0,
        };
        current.incomeUsd += project.incomes.reduce((sum, income) => sum + requireNumber(income.amountUsd), 0);
        current.activeProjects += project.status === ProjectStatus.active ? 1 : 0;
        current.pendingPayments += project.scheduledPayments.filter(
          (payment) => isOpenScheduledStatus(payment.status),
        ).length;
        acc.set(project.client.name, current);
        return acc;
      },
      new Map<string, { clientName: string; incomeUsd: number; activeProjects: number; pendingPayments: number }>(),
    );

  const alerts = await getAlerts();

  return {
    filters: {
      from: filters?.from ?? null,
      to: filters?.to ?? null,
      clientId: filters?.clientId ?? null,
      projectId: filters?.projectId ?? null,
    },
    kpis: {
      incomesUsd: mappedIncomes.reduce((sum, item) => sum + item.amountUsd, 0),
      expensesUsd: mappedExpenses.reduce((sum, item) => sum + item.amountUsd, 0),
      netUsd:
        mappedIncomes.reduce((sum, item) => sum + item.amountUsd, 0) -
        mappedExpenses.reduce((sum, item) => sum + item.amountUsd, 0),
      remanenteUsd: summary.remanenteUsd,
      receivableUsd: mappedPayments
        .filter((payment) => isOpenScheduledStatus(payment.status as ScheduledPaymentStatus))
        .reduce((sum, item) => sum + item.expectedAmountUsd, 0),
      overdueUsd: mappedPayments
        .filter((payment) => payment.status === "overdue")
        .reduce((sum, item) => sum + item.expectedAmountUsd, 0),
      salariesThisMonthUsd: salaries.reduce((sum, item) => sum + requireNumber(item.amountUsd), 0),
    },
    charts: {
      monthlyPerformance,
      categoryBreakdown,
      cumulativeCashflow,
      topClients: Array.from(topClients.values()).sort((a, b) => b.incomeUsd - a.incomeUsd).slice(0, 5),
    },
    upcomingPayments: mappedPayments.filter((payment) => isOpenScheduledStatus(payment.status as ScheduledPaymentStatus)).slice(0, 10),
    distribution: layers.map(mapDistributionRecord),
    alerts,
  };
}
