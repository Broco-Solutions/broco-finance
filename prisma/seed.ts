import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import {
  ContractFrequency,
  ExpenseType,
  IncomeType,
  PrismaClient,
  ProjectStatus,
  ScheduledPaymentStatus,
} from "@prisma/client";
import { addMonths, isValid, parse, startOfDay, startOfMonth } from "date-fns";
import * as XLSX from "xlsx";

type SheetRow = Record<string, unknown>;

type ParsedMoney = {
  amountArs: number | null;
  amountUsd: number;
  exchangeRate: number | null;
};

type ParsedIncomeRow = {
  date: Date;
  clientName: string;
  projectName: string;
  projectStatus: ProjectStatus;
  type: IncomeType;
  notes: string | null;
  money: ParsedMoney;
};

type ParsedExpenseRow = {
  date: Date;
  categoryName: string;
  expenseType: ExpenseType;
  projectName: string | null;
  description: string;
  notes: string | null;
  money: ParsedMoney;
};

type ParsedRecurringGroup = {
  clientName: string;
  projectName: string;
  projectStatus: ProjectStatus;
  description: string;
  frequency: ContractFrequency;
  startDate: Date;
  nextDueDate: Date;
  latestAmountUsd: number;
  latestAmountArs: number | null;
  notes: string | null;
  endDate: Date | null;
};

function frequencyStepMonths(frequency: ContractFrequency) {
  switch (frequency) {
    case ContractFrequency.quarterly:
      return 3;
    case ContractFrequency.biannual:
      return 6;
    case ContractFrequency.annual:
      return 12;
    default:
      return 1;
  }
}

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  "Marketing",
  "Herramientas/Software",
  "Infra/Cloud",
  "Hosting/Dominios",
  "Email/Zoho",
  "Publicidad (Ads)",
  "Sueldos/Honorarios",
  "Contabilidad/Legal",
  "Viajes/Viáticos",
  "Prospección/Demos",
  "Hardware",
  "Otros",
];

const INTERNAL_CLIENT_NAME = "BROCO SOLUTIONS";
const INTERNAL_PROJECT_NAME = "Ajustes Financieros";

const MONTHS: Record<string, number> = {
  enero: 0,
  feb: 1,
  febrero: 1,
  mar: 2,
  marzo: 2,
  abr: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  jul: 6,
  julio: 6,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  oct: 9,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  dic: 11,
  diciembre: 11,
};

function cleanText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function parseCurrency(value: unknown) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\$/g, "").replace(/\s+/g, "");
  const sanitized =
    normalized.includes(",") && normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");

  const amount = Number(sanitized);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeCategoryName(value: unknown) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  if (text.toLowerCase() === "publicidad (ads)") {
    return "Publicidad (Ads)";
  }

  return text;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && isValid(value)) {
    return startOfDay(value);
  }

  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const patterns = ["d/M/yy", "d/M/yyyy", "dd/MM/yy", "dd/MM/yyyy", "yyyy-MM-dd", "M/d/yy", "M/d/yyyy"];

  for (const pattern of patterns) {
    const parsed = parse(text, pattern, new Date());
    if (isValid(parsed)) {
      return startOfDay(parsed);
    }
  }

  return null;
}

function extractExchangeRate(row: SheetRow) {
  const rateKey = Object.keys(row).find((key) =>
    key.toLowerCase().includes("tipo de cambio") ||
    key.toLowerCase() === "tc" ||
    key.toLowerCase().includes("exchange"),
  );

  return rateKey ? parseCurrency(row[rateKey]) : null;
}

function parseMoney(row: SheetRow): ParsedMoney | null {
  const amountArs = parseCurrency(row["Monto ARS"]);
  const usdColumn = parseCurrency(row["Monto USD"]);
  const explicitRate = extractExchangeRate(row);
  const amountUsd = usdColumn ?? (amountArs && explicitRate ? amountArs / explicitRate : null);

  if (amountUsd === null) {
    return null;
  }

  const exchangeRate = explicitRate ?? (amountArs && amountUsd ? amountArs / amountUsd : null);

  return {
    amountArs,
    amountUsd,
    exchangeRate,
  };
}

function normalizeProjectStatus(value: unknown, fallback: ProjectStatus = ProjectStatus.active) {
  const text = cleanText(value)?.toLowerCase();

  if (!text) {
    return fallback;
  }

  if (text.includes("final")) {
    return ProjectStatus.finished;
  }

  if (text.includes("cancel")) {
    return ProjectStatus.cancelled;
  }

  return ProjectStatus.active;
}

function normalizeIncomeType(value: unknown, notes: string | null) {
  const text = cleanText(value)?.toLowerCase();

  if (!text) {
    return notes?.toLowerCase().includes("interes") ? IncomeType.final_payment : IncomeType.advance;
  }

  if (text.includes("recurrente")) {
    return IncomeType.recurring;
  }

  if (text.includes("final")) {
    return IncomeType.final_payment;
  }

  return IncomeType.advance;
}

function normalizeExpenseType(value: unknown) {
  const text = cleanText(value)?.toLowerCase();
  return text?.includes("variable") ? ExpenseType.variable : ExpenseType.fixed;
}

function isMeaningfulIncomeRow(row: SheetRow) {
  const date = parseDateValue(row["Fecha"]);
  const money = parseMoney(row);
  return Boolean(date && money);
}

function isMeaningfulExpenseRow(row: SheetRow) {
  const date = parseDateValue(row["Fecha"]);
  const money = parseMoney(row);
  const category = cleanText(row["Categoría"]);
  return Boolean(date && money && category);
}

function monthNameToIndex(value: string | null) {
  if (!value) {
    return null;
  }

  return MONTHS[value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")] ?? null;
}

function inferFrequency(notes: string | null) {
  const normalized = notes?.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") ?? "";
  if (normalized.includes("anual")) return ContractFrequency.annual;
  if (normalized.includes("semestral") || normalized.includes("biannual")) return ContractFrequency.biannual;
  if (normalized.includes("trimestral")) return ContractFrequency.quarterly;
  return ContractFrequency.monthly;
}

function parseCoveredUntil(notes: string | null, referenceDate: Date) {
  if (!notes) {
    return null;
  }

  const normalized = notes.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const untilMatch = normalized.match(/hasta\s+([a-z]+)\s+(\d{4})/i);
  if (untilMatch) {
    const month = monthNameToIndex(untilMatch[1]);
    const year = Number(untilMatch[2]);
    if (month !== null && Number.isFinite(year)) {
      return new Date(year, month, 1);
    }
  }

  const rangeMatch = normalized.match(/([a-z]+)\s+a\s+([a-z]+)\s+(\d{4})/i);
  if (rangeMatch) {
    const endMonth = monthNameToIndex(rangeMatch[2]);
    const year = Number(rangeMatch[3]);
    if (endMonth !== null && Number.isFinite(year)) {
      return new Date(year, endMonth, 1);
    }
  }

  const pairMatch = normalized.match(/([a-z]+)\s+y\s+([a-z]+)/i);
  if (pairMatch) {
    const secondMonth = monthNameToIndex(pairMatch[2]);
    if (secondMonth !== null) {
      let year = referenceDate.getFullYear();
      if (secondMonth > referenceDate.getMonth()) {
        year -= 1;
      }
      return new Date(year, secondMonth, 1);
    }
  }

  return null;
}

function monthDiffInclusive(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

function extractCoverageMonths(notes: string | null, paymentDate: Date) {
  if (!notes) {
    return 1;
  }

  const normalized = notes.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  if (/mensual|mantenimiento mensual/.test(normalized)) {
    return 1;
  }

  const until = parseCoveredUntil(notes, paymentDate);
  if (until && /pagado hasta|hasta/.test(normalized)) {
    return Math.max(1, monthDiffInclusive(startOfMonth(paymentDate), startOfMonth(until)));
  }

  const rangeMatch = normalized.match(/([a-z]+)\s+a\s+([a-z]+)\s+(\d{4})/i);
  if (rangeMatch) {
    const startMonth = monthNameToIndex(rangeMatch[1]);
    const endMonth = monthNameToIndex(rangeMatch[2]);
    const year = Number(rangeMatch[3]);
    if (startMonth !== null && endMonth !== null && Number.isFinite(year)) {
      return Math.max(1, monthDiffInclusive(new Date(year, startMonth, 1), new Date(year, endMonth, 1)));
    }
  }

  if (normalized.match(/([a-z]+)\s+y\s+([a-z]+)/i)) {
    return 2;
  }

  return 1;
}

function parseContractEndDate(notes: string | null, paymentDate: Date) {
  if (!notes) {
    return null;
  }

  const normalized = notes.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (!/mensual|mantenimiento mensual/.test(normalized)) {
    return null;
  }

  return parseCoveredUntil(notes, paymentDate);
}

function inferRecurringDescription(projectName: string, notes: string | null) {
  if (notes) {
    const normalized = notes.trim();
    if (/mantenimiento/i.test(normalized) || /mensual/i.test(normalized)) {
      return normalized;
    }
  }

  return `Servicio recurrente - ${projectName}`;
}

function inferNextDueDate(groupRows: ParsedIncomeRow[], frequency: ContractFrequency) {
  const latest = [...groupRows].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  const coveredUntil = parseCoveredUntil(latest.notes, latest.date);
  const base =
    latest.notes && /mensual|mantenimiento mensual/i.test(latest.notes)
      ? startOfMonth(latest.date)
      : coveredUntil
        ? startOfMonth(coveredUntil)
        : startOfMonth(latest.date);
  const monthsStep =
    frequency === ContractFrequency.annual
      ? 12
      : frequency === ContractFrequency.biannual
        ? 6
        : frequency === ContractFrequency.quarterly
          ? 3
          : 1;

  return addMonths(base, monthsStep);
}

function findWorkbookPath() {
  const explicit = process.env.BROCO_SEED_FILE;
  if (explicit) {
    const resolved = path.resolve(process.cwd(), explicit);
    if (!existsSync(resolved)) {
      throw new Error(`No existe el archivo definido en BROCO_SEED_FILE: ${resolved}`);
    }
    return resolved;
  }

  const candidate = readdirSync(process.cwd()).find(
    (file) => file.toLowerCase().endsWith(".xlsx") && !file.includes("Zone.Identifier"),
  );

  if (!candidate) {
    throw new Error("No se encontró ningún archivo .xlsx para migrar.");
  }

  return path.resolve(process.cwd(), candidate);
}

function readSheet(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`La hoja "${sheetName}" no existe en el workbook.`);
  }
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: false });
}

function buildProjectKey(clientName: string, projectName: string) {
  return `${clientName}::${projectName}`;
}

async function main() {
  const workbookPath = findWorkbookPath();
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });

  const rawIncomeRows = readSheet(workbook, "Ingresos");
  const rawExpenseRows = readSheet(workbook, "Gastos");
  const rawDistributionRows = readSheet(workbook, "Distribución");

  const parsedIncomes: ParsedIncomeRow[] = rawIncomeRows
    .filter(isMeaningfulIncomeRow)
    .map((row) => {
      const date = parseDateValue(row["Fecha"]);
      const money = parseMoney(row);
      const notes = cleanText(row["Observaciones"]);
      const rawClientName = cleanText(row["Cliente"]);
      const rawProjectName = cleanText(row["Proyecto"]);
      const clientName = rawClientName ?? INTERNAL_CLIENT_NAME;
      const projectName = rawProjectName ?? INTERNAL_PROJECT_NAME;

      if (!date || !money) {
        throw new Error(`Fila de ingreso inválida: ${JSON.stringify(row)}`);
      }

      return {
        date,
        clientName,
        projectName,
        projectStatus: normalizeProjectStatus(row["Estado del proyecto"], rawClientName ? ProjectStatus.active : ProjectStatus.finished),
        type: normalizeIncomeType(row["Tipo de Ingreso"], notes),
        notes,
        money,
      };
    });

  const parsedExpenses: ParsedExpenseRow[] = rawExpenseRows
    .filter(isMeaningfulExpenseRow)
    .map((row) => {
      const date = parseDateValue(row["Fecha"]);
      const money = parseMoney(row);
      const categoryName = normalizeCategoryName(row["Categoría"]);

      if (!date || !money || !categoryName) {
        throw new Error(`Fila de gasto inválida: ${JSON.stringify(row)}`);
      }

      const projectName = cleanText(row["Proyecto (si aplica)"]);
      const notes = cleanText(row["Observaciones"]);

      return {
        date,
        categoryName,
        expenseType: normalizeExpenseType(row["Tipo de Gasto"]),
        projectName,
        description: notes ?? categoryName,
        notes,
        money,
      };
    });

  const distributionRows = rawDistributionRows
    .map((row) => {
      const labelKey = Object.keys(row).find((key) => key.toLowerCase().includes("mes a consultar"));
      if (!labelKey) {
        return null;
      }

      const label = cleanText(row[labelKey]);
      const keys = Object.keys(row);
      const valueKey = keys[1];
      const locationKey = keys[2];

      if (!label || !valueKey) {
        return null;
      }

      return {
        label,
        amount: parseCurrency(row[valueKey]),
        location: cleanText(row[locationKey]),
      };
    })
    .filter((row): row is { label: string; amount: number | null; location: string | null } => Boolean(row && row.amount !== null));

  const clientNames = new Set(parsedIncomes.map((row) => row.clientName));
  const projectSeeds = new Map<string, { clientName: string; projectName: string; status: ProjectStatus }>();

  for (const income of parsedIncomes) {
    projectSeeds.set(buildProjectKey(income.clientName, income.projectName), {
      clientName: income.clientName,
      projectName: income.projectName,
      status: income.projectStatus,
    });
  }

  for (const expense of parsedExpenses) {
    if (expense.projectName) {
      projectSeeds.set(buildProjectKey(INTERNAL_CLIENT_NAME, expense.projectName), {
        clientName: INTERNAL_CLIENT_NAME,
        projectName: expense.projectName,
        status: ProjectStatus.active,
      });
      clientNames.add(INTERNAL_CLIENT_NAME);
    }
  }

  const recurringByProject = new Map<string, ParsedIncomeRow[]>();
  for (const income of parsedIncomes.filter((row) => row.type === IncomeType.recurring)) {
    const key = buildProjectKey(income.clientName, income.projectName);
    recurringByProject.set(key, [...(recurringByProject.get(key) ?? []), income]);
  }

  const recurringContracts: ParsedRecurringGroup[] = Array.from(recurringByProject.values()).map((rows) => {
    const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const latest = sorted[sorted.length - 1];
    const frequency = inferFrequency(latest.notes);
    const coverageMonths = extractCoverageMonths(latest.notes, latest.date);
    const latestAmountUsd = latest.money.amountUsd / coverageMonths;
    const latestAmountArs = latest.money.amountArs !== null ? latest.money.amountArs / coverageMonths : null;

    return {
      clientName: latest.clientName,
      projectName: latest.projectName,
      projectStatus: latest.projectStatus,
      description: inferRecurringDescription(latest.projectName, latest.notes),
      frequency,
      startDate: sorted[0].date,
      nextDueDate: inferNextDueDate(sorted, frequency),
      latestAmountUsd,
      latestAmountArs,
      notes: Array.from(new Set(sorted.map((row) => row.notes).filter(Boolean))).join(" | ") || null,
      endDate: parseContractEndDate(latest.notes, latest.date),
    };
  });

  const categories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...parsedExpenses.map((expense) => expense.categoryName)]),
  );

  await prisma.scheduledPayment.deleteMany();
  await prisma.recurringContract.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.salaryWithdrawal.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.distributionConfig.deleteMany();

  const clientMap = new Map<string, string>();
  for (const clientName of clientNames) {
    const client = await prisma.client.upsert({
      where: {
        name: clientName,
      },
      update: {},
      create: {
        name: clientName,
      },
    });
    clientMap.set(clientName, client.id);
  }

  const projectMap = new Map<string, string>();
  for (const projectSeed of projectSeeds.values()) {
    const clientId = clientMap.get(projectSeed.clientName)!;
    const project = await prisma.project.upsert({
      where: {
        clientId_name: {
          clientId,
          name: projectSeed.projectName,
        },
      },
      update: {
        status: projectSeed.status,
      },
      create: {
        clientId,
        name: projectSeed.projectName,
        status: projectSeed.status,
      },
    });
    projectMap.set(buildProjectKey(projectSeed.clientName, projectSeed.projectName), project.id);
  }

  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const expenseCategory = await prisma.expenseCategory.upsert({
      where: {
        name: category,
      },
      update: {
        isDefault: true,
      },
      create: {
        name: category,
        isDefault: true,
      },
    });
    categoryMap.set(expenseCategory.name, expenseCategory.id);
  }

  for (const income of parsedIncomes) {
    await prisma.income.create({
      data: {
        projectId: projectMap.get(buildProjectKey(income.clientName, income.projectName))!,
        date: income.date,
        amountArs: income.money.amountArs,
        amountUsd: income.money.amountUsd,
        exchangeRate: income.money.exchangeRate,
        type: income.type,
        notes: income.notes,
      },
    });
  }

  for (const expense of parsedExpenses) {
    const projectId = expense.projectName
      ? projectMap.get(buildProjectKey(INTERNAL_CLIENT_NAME, expense.projectName)) ?? null
      : null;

    await prisma.expense.create({
      data: {
        date: expense.date,
        categoryId: categoryMap.get(expense.categoryName)!,
        expenseType: expense.expenseType,
        projectId,
        amountArs: expense.money.amountArs,
        amountUsd: expense.money.amountUsd,
        exchangeRate: expense.money.exchangeRate,
        description: expense.description,
        notes: expense.notes,
      },
    });
  }

  for (const contract of recurringContracts) {
    const recurring = await prisma.recurringContract.create({
      data: {
        projectId: projectMap.get(buildProjectKey(contract.clientName, contract.projectName))!,
        description: contract.description,
        amountUsd: contract.latestAmountUsd,
        amountArs: contract.latestAmountArs,
        frequency: contract.frequency,
        startDate: contract.startDate,
        endDate: contract.endDate,
        isActive: true,
        notes: contract.notes,
      },
    });

    let generated = 0;
    let cursor = startOfMonth(contract.nextDueDate);
    while (generated < 12 && (!contract.endDate || cursor <= startOfMonth(contract.endDate))) {
      const expectedDate = cursor;
      await prisma.scheduledPayment.create({
        data: {
          recurringContractId: recurring.id,
          projectId: recurring.projectId,
          expectedDate,
          expectedAmountUsd: contract.latestAmountUsd,
          status: expectedDate < startOfMonth(new Date()) ? ScheduledPaymentStatus.overdue : ScheduledPaymentStatus.pending,
          notes: `Generado desde seed XLSX (${path.basename(workbookPath)})`,
        },
      });
      generated += 1;
      cursor = addMonths(cursor, frequencyStepMonths(contract.frequency));
    }
  }

  const emergency = distributionRows.find((row) => /capa 1/i.test(row.label));
  const growth = distributionRows.find((row) => /capa 2/i.test(row.label));

  if (emergency) {
    await prisma.distributionConfig.upsert({
      where: {
        layer: "emergency",
      },
      update: {
        currentAmountUsd: emergency.amount!,
        storageLocation: emergency.location,
      },
      create: {
        layer: "emergency",
        currentAmountUsd: emergency.amount!,
        storageLocation: emergency.location,
      },
    });
  }

  if (growth) {
    await prisma.distributionConfig.upsert({
      where: {
        layer: "growth",
      },
      update: {
        currentAmountUsd: growth.amount!,
        storageLocation: growth.location,
      },
      create: {
        layer: "growth",
        currentAmountUsd: growth.amount!,
        storageLocation: growth.location,
      },
    });
  }

  const [
    clients,
    projects,
    incomes,
    expenses,
    expenseCategories,
    recurringCount,
    scheduledPayments,
    distributionCount,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.project.count(),
    prisma.income.count(),
    prisma.expense.count(),
    prisma.expenseCategory.count(),
    prisma.recurringContract.count(),
    prisma.scheduledPayment.count(),
    prisma.distributionConfig.count(),
  ]);

  const counts = {
    workbook: path.basename(workbookPath),
    clients,
    projects,
    incomes,
    expenses,
    expenseCategories,
    recurringContracts: recurringCount,
    scheduledPayments,
    distributionConfig: distributionCount,
  };

  console.log("Seed XLSX completado:");
  console.table(counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
