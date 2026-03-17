export type ProjectStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type IncomeStatus = "PAID" | "PENDING";
export type IncomeType = "DEVELOPMENT" | "MAINTENANCE";
export type ContractFrequency = "monthly" | "quarterly" | "biannual" | "annual";
export type ScheduledPaymentStatus = "pending" | "paid" | "overdue" | "cancelled";
export type ScheduledExpenseStatus = "PENDING" | "PAID";
export type ExpenseType = "fixed" | "variable";
export type DistributionLayer = "emergency" | "growth";

export type MonetaryFields = {
  amountUsd: number;
  amountArs: number | null;
  exchangeRate: number | null;
};

export type ClientRecord = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  totalInvoicedUsd: number;
  totalReceivableUsd: number;
  activeProjects: number;
  totalProjects: number;
};

export type ProjectRecord = {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  status: ProjectStatus;
  devBudgetUsd: number | null;
  monthlyFeeUsd: number | null;
  monthlyFeeEndDate: string | null;
  notes: string | null;
  pendingIncomeCount: number;
  developmentCollectedUsd: number;
  maintenanceCollectedUsd: number;
  developmentPendingUsd: number | null;
  totalCollectedUsd: number;
  nextPaymentDate: string | null;
};

export type IncomeRecord = MonetaryFields & {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  date: string;
  correspondsToDate?: string | null;
  status: IncomeStatus;
  type: IncomeType;
  notes: string | null;
};

export type ExpenseCategoryRecord = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type ExpenseRecord = MonetaryFields & {
  id: string;
  date: string;
  categoryId: string;
  categoryName: string;
  expenseType: ExpenseType;
  projectId: string | null;
  projectName: string | null;
  description: string;
  salaryWithdrawalId: string | null;
  scheduledExpenseId?: string | null;
  notes: string | null;
};

export type RecurringExpenseRecord = {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  amountUsd: number;
  startDate: string;
  frequency: ContractFrequency;
  isActive: boolean;
  nextDueDate: string | null;
  pendingCount: number;
};

export type ScheduledExpenseRecord = {
  id: string;
  recurringExpenseId: string;
  description: string;
  categoryId: string;
  categoryName: string;
  dueDate: string;
  amountUsd: number;
  status: ScheduledExpenseStatus;
  paidAt: string | null;
  actualExpenseId: string | null;
};

export type DistributionRecord = {
  id: string;
  layer: DistributionLayer;
  currentAmountUsd: number;
  storageLocation: string | null;
};

export type SalaryRecord = MonetaryFields & {
  id: string;
  personName: string;
  month: string;
  date: string;
  notes: string | null;
};

export type ScheduledPaymentRecord = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  type: IncomeType;
  expectedDate: string;
  expectedAmountUsd: number;
  status: ScheduledPaymentStatus;
  paidAt: string | null;
  actualIncomeId: string | null;
  notes: string | null;
};

export type SubscriptionLifecycleAlert = {
  projectId: string;
  projectName: string;
  clientName: string;
  monthlyFeeUsd: number;
  endDate: string;
  daysRemaining: number;
};

export type AlertsPayload = {
  overdue: { count: number; totalUsd: number; items: ScheduledPaymentRecord[] };
  upcoming7Days: { count: number; totalUsd: number; items: ScheduledPaymentRecord[] };
  upcoming30Days: { count: number; totalUsd: number; items: ScheduledPaymentRecord[] };
  subscriptionsEndingSoon: { count: number; items: SubscriptionLifecycleAlert[] };
};

export type DistributionSummary = {
  totalIncomeUsd: number;
  totalExpenseUsd: number;
  netResultUsd: number;
  remanenteUsd: number;
};

export type DashboardPayload = {
  filters: {
    from: string | null;
    to: string | null;
    clientId: string | null;
    projectId: string | null;
  };
  kpis: {
    incomesUsd: number;
    expensesUsd: number;
    netUsd: number;
    remanenteUsd: number;
    receivableUsd: number;
    overdueUsd: number;
    committedExpensesMonthUsd: number;
    salariesThisMonthUsd: number;
  };
  charts: {
    monthlyPerformance: Array<{ month: string; incomeUsd: number; expenseUsd: number; netUsd: number }>;
    categoryBreakdown: Array<{ category: string; amountUsd: number }>;
    cumulativeCashflow: Array<{ month: string; valueUsd: number }>;
    topClients: Array<{ clientName: string; incomeUsd: number; activeProjects: number; pendingPayments: number }>;
  };
  upcomingPayments: ScheduledPaymentRecord[];
  distribution: DistributionRecord[];
  alerts: AlertsPayload;
};

export type ClientDetailPayload = {
  client: ClientRecord;
  projects: ProjectRecord[];
  incomes: IncomeRecord[];
  payments: ScheduledPaymentRecord[];
};

export type ProjectDetailPayload = {
  project: ProjectRecord;
  incomes: IncomeRecord[];
  scheduledPayments: ScheduledPaymentRecord[];
  expenses: ExpenseRecord[];
};

export type DistributionPagePayload = {
  layers: DistributionRecord[];
  summary: DistributionSummary;
  salaries: SalaryRecord[];
};

export type ApiEnvelope<T> = {
  data: T;
  meta?: {
    demoMode?: boolean;
    message?: string;
  };
};
