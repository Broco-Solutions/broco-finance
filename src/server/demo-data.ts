import type {
  AlertsPayload,
  ClientDetailPayload,
  ClientRecord,
  DashboardPayload,
  DistributionPagePayload,
  DistributionRecord,
  ExpenseCategoryRecord,
  ExpenseRecord,
  IncomeRecord,
  ProjectDetailPayload,
  ProjectRecord,
  RecurringContractRecord,
  SalaryRecord,
  ScheduledPaymentRecord,
} from "@/lib/types";

export const demoClients: ClientRecord[] = [
  {
    id: "client-pacsa",
    name: "PACSA",
    notes: "Automatizaciones comerciales",
    totalInvoicedUsd: 11200,
    totalReceivableUsd: 2400,
    activeProjects: 2,
    totalProjects: 2,
  },
  {
    id: "client-colegio",
    name: "COLEGIO",
    notes: "Implementación operativa y mantenimiento",
    totalInvoicedUsd: 8900,
    totalReceivableUsd: 1850,
    activeProjects: 1,
    totalProjects: 1,
  },
  {
    id: "client-faufena",
    name: "FAUFENA",
    notes: "Sitio institucional",
    totalInvoicedUsd: 5200,
    totalReceivableUsd: 0,
    activeProjects: 0,
    totalProjects: 1,
  },
];

export const demoProjects: ProjectRecord[] = [
  {
    id: "project-whatsapp",
    clientId: "client-pacsa",
    clientName: "PACSA",
    name: "Automatización WhatsApp",
    status: "active",
    totalBudgetUsd: 10000,
    notes: "Pipeline comercial y recordatorios",
    totalCollectedUsd: 7600,
    nextPaymentDate: "2026-03-18",
  },
  {
    id: "project-analytics",
    clientId: "client-pacsa",
    clientName: "PACSA",
    name: "Tablero Analytics",
    status: "active",
    totalBudgetUsd: 4200,
    notes: null,
    totalCollectedUsd: 3600,
    nextPaymentDate: "2026-03-28",
  },
  {
    id: "project-mantenimiento",
    clientId: "client-colegio",
    clientName: "COLEGIO",
    name: "Mantenimiento Web",
    status: "active",
    totalBudgetUsd: null,
    notes: "Contrato recurrente",
    totalCollectedUsd: 5200,
    nextPaymentDate: "2026-03-20",
  },
  {
    id: "project-faufena-site",
    clientId: "client-faufena",
    clientName: "FAUFENA",
    name: "Sitio Institucional",
    status: "finished",
    totalBudgetUsd: 5200,
    notes: null,
    totalCollectedUsd: 5200,
    nextPaymentDate: null,
  },
];

export const demoIncomes: IncomeRecord[] = [
  {
    id: "inc-1",
    projectId: "project-whatsapp",
    projectName: "Automatización WhatsApp",
    clientName: "PACSA",
    date: "2026-01-12",
    amountArs: null,
    amountUsd: 2400,
    exchangeRate: null,
    type: "advance",
    notes: "Primer adelanto",
  },
  {
    id: "inc-2",
    projectId: "project-whatsapp",
    projectName: "Automatización WhatsApp",
    clientName: "PACSA",
    date: "2026-02-15",
    amountArs: 2280000,
    amountUsd: 2200,
    exchangeRate: 1036,
    type: "final_payment",
    notes: "Segundo hito",
  },
  {
    id: "inc-3",
    projectId: "project-analytics",
    projectName: "Tablero Analytics",
    clientName: "PACSA",
    date: "2026-02-03",
    amountArs: null,
    amountUsd: 1800,
    exchangeRate: null,
    type: "advance",
    notes: null,
  },
  {
    id: "inc-4",
    projectId: "project-mantenimiento",
    projectName: "Mantenimiento Web",
    clientName: "COLEGIO",
    date: "2026-03-01",
    amountArs: null,
    amountUsd: 950,
    exchangeRate: null,
    type: "recurring",
    notes: "Febrero pagado",
  },
  {
    id: "inc-5",
    projectId: "project-faufena-site",
    projectName: "Sitio Institucional",
    clientName: "FAUFENA",
    date: "2025-12-11",
    amountArs: null,
    amountUsd: 5200,
    exchangeRate: null,
    type: "final_payment",
    notes: "Proyecto cerrado",
  },
];

export const demoCategories: ExpenseCategoryRecord[] = [
  { id: "cat-software", name: "Herramientas/Software", isDefault: true },
  { id: "cat-cloud", name: "Infra/Cloud", isDefault: true },
  { id: "cat-salary", name: "Sueldos/Honorarios", isDefault: true },
  { id: "cat-marketing", name: "Marketing", isDefault: true },
];

export const demoExpenses: ExpenseRecord[] = [
  {
    id: "exp-1",
    date: "2026-01-09",
    categoryId: "cat-software",
    categoryName: "Herramientas/Software",
    expenseType: "fixed",
    projectId: null,
    projectName: null,
    amountArs: null,
    amountUsd: 120,
    exchangeRate: null,
    description: "ChatGPT Teams",
    salaryWithdrawalId: null,
    notes: null,
  },
  {
    id: "exp-2",
    date: "2026-02-04",
    categoryId: "cat-cloud",
    categoryName: "Infra/Cloud",
    expenseType: "fixed",
    projectId: "project-whatsapp",
    projectName: "Automatización WhatsApp",
    amountArs: null,
    amountUsd: 210,
    exchangeRate: null,
    description: "Vercel + Neon",
    salaryWithdrawalId: null,
    notes: null,
  },
  {
    id: "exp-3",
    date: "2026-03-06",
    categoryId: "cat-salary",
    categoryName: "Sueldos/Honorarios",
    expenseType: "fixed",
    projectId: null,
    projectName: null,
    amountArs: null,
    amountUsd: 1600,
    exchangeRate: null,
    description: "Salario Tomas - Mar 2026",
    salaryWithdrawalId: "salary-1",
    notes: null,
  },
  {
    id: "exp-4",
    date: "2026-03-07",
    categoryId: "cat-marketing",
    categoryName: "Marketing",
    expenseType: "variable",
    projectId: "project-analytics",
    projectName: "Tablero Analytics",
    amountArs: 580000,
    amountUsd: 560,
    exchangeRate: 1035.71,
    description: "Campaña Meta Ads",
    salaryWithdrawalId: null,
    notes: null,
  },
];

export const demoLayers: DistributionRecord[] = [
  {
    id: "layer-emergency",
    layer: "emergency",
    currentAmountUsd: 2000,
    storageLocation: "Cocos Capital",
  },
  {
    id: "layer-growth",
    layer: "growth",
    currentAmountUsd: 4000,
    storageLocation: "Naranja X",
  },
];

export const demoSalaries: SalaryRecord[] = [
  {
    id: "salary-1",
    personName: "Tomas",
    month: "2026-03-01",
    date: "2026-03-06",
    amountUsd: 1600,
    amountArs: null,
    exchangeRate: null,
    notes: "Retiro operativo",
  },
];

export const demoRecurringContracts: RecurringContractRecord[] = [
  {
    id: "rec-1",
    projectId: "project-mantenimiento",
    projectName: "Mantenimiento Web",
    clientName: "COLEGIO",
    description: "Mantenimiento mensual sitio web",
    amountUsd: 950,
    amountArs: null,
    exchangeRate: null,
    frequency: "monthly",
    startDate: "2025-11-01",
    endDate: null,
    isActive: true,
    notes: "Ajuste trimestral manual",
    nextDueDate: "2026-03-20",
  },
];

export const demoScheduledPayments: ScheduledPaymentRecord[] = [
  {
    id: "pay-1",
    recurringContractId: "rec-1",
    projectId: "project-mantenimiento",
    projectName: "Mantenimiento Web",
    clientName: "COLEGIO",
    expectedDate: "2026-03-20",
    expectedAmountUsd: 950,
    status: "pending",
    actualIncomeId: null,
    notes: "Factura enviada",
  },
  {
    id: "pay-2",
    recurringContractId: null,
    projectId: "project-whatsapp",
    projectName: "Automatización WhatsApp",
    clientName: "PACSA",
    expectedDate: "2026-03-18",
    expectedAmountUsd: 2400,
    status: "pending",
    actualIncomeId: null,
    notes: "Cierre del proyecto",
  },
  {
    id: "pay-3",
    recurringContractId: null,
    projectId: "project-analytics",
    projectName: "Tablero Analytics",
    clientName: "PACSA",
    expectedDate: "2026-03-10",
    expectedAmountUsd: 600,
    status: "overdue",
    actualIncomeId: null,
    notes: "Pendiente de cobranza",
  },
];

export const demoAlerts: AlertsPayload = {
  overdue: {
    count: 1,
    totalUsd: 600,
    items: demoScheduledPayments.filter((item) => item.status === "overdue"),
  },
  upcoming7Days: {
    count: 2,
    totalUsd: 3350,
    items: demoScheduledPayments.filter((item) => item.status === "pending"),
  },
  upcoming30Days: {
    count: 2,
    totalUsd: 3350,
    items: demoScheduledPayments.filter((item) => item.status === "pending"),
  },
};

export const demoDistributionPage: DistributionPagePayload = {
  layers: demoLayers,
  summary: {
    totalIncomeUsd: 12550,
    totalExpenseUsd: 2490,
    netResultUsd: 10060,
    remanenteUsd: 4060,
  },
  salaries: demoSalaries,
};

export const demoDashboard: DashboardPayload = {
  filters: {
    from: null,
    to: null,
    clientId: null,
    projectId: null,
  },
  kpis: {
    incomesUsd: 12550,
    expensesUsd: 2490,
    netUsd: 10060,
    remanenteUsd: 4060,
    receivableUsd: 3950,
    overdueUsd: 600,
    salariesThisMonthUsd: 1600,
  },
  charts: {
    monthlyPerformance: [
      { month: "Jan", incomeUsd: 2400, expenseUsd: 120, netUsd: 2280 },
      { month: "Feb", incomeUsd: 4000, expenseUsd: 210, netUsd: 3790 },
      { month: "Mar", incomeUsd: 6150, expenseUsd: 2160, netUsd: 3990 },
    ],
    categoryBreakdown: [
      { category: "Sueldos/Honorarios", amountUsd: 1600 },
      { category: "Marketing", amountUsd: 560 },
      { category: "Infra/Cloud", amountUsd: 210 },
      { category: "Herramientas/Software", amountUsd: 120 },
    ],
    cumulativeCashflow: [
      { month: "Jan", valueUsd: 2280 },
      { month: "Feb", valueUsd: 6070 },
      { month: "Mar", valueUsd: 10060 },
    ],
    topClients: [
      { clientName: "PACSA", incomeUsd: 7600, activeProjects: 2, pendingPayments: 2 },
      { clientName: "COLEGIO", incomeUsd: 5200, activeProjects: 1, pendingPayments: 1 },
      { clientName: "FAUFENA", incomeUsd: 5200, activeProjects: 0, pendingPayments: 0 },
    ],
  },
  upcomingPayments: demoScheduledPayments,
  distribution: demoLayers,
  alerts: demoAlerts,
};

export const demoClientDetails = new Map<string, ClientDetailPayload>(
  demoClients.map((client) => [
    client.id,
    {
      client,
      projects: demoProjects.filter((project) => project.clientId === client.id),
      incomes: demoIncomes.filter((income) => demoProjects.find((project) => project.id === income.projectId)?.clientId === client.id),
      payments: demoScheduledPayments.filter(
        (payment) => demoProjects.find((project) => project.id === payment.projectId)?.clientId === client.id,
      ),
    },
  ]),
);

export const demoProjectDetails = new Map<string, ProjectDetailPayload>(
  demoProjects.map((project) => [
    project.id,
    {
      project,
      incomes: demoIncomes.filter((income) => income.projectId === project.id),
      recurringContracts: demoRecurringContracts.filter((contract) => contract.projectId === project.id),
      scheduledPayments: demoScheduledPayments.filter((payment) => payment.projectId === project.id),
      expenses: demoExpenses.filter((expense) => expense.projectId === project.id),
    },
  ]),
);
