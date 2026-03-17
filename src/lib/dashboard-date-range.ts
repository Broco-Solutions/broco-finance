import {
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { formatShortDate } from "@/lib/utils";

export const dashboardDatePresets = [
  { value: "this-month", label: "Este Mes" },
  { value: "last-month", label: "Mes Pasado" },
  { value: "last-3-months", label: "Ultimos 3 Meses" },
  { value: "year-current", label: "Ano Actual" },
  { value: "custom", label: "Personalizado" },
] as const;

export type DashboardDatePreset = (typeof dashboardDatePresets)[number]["value"];

type DashboardDateRangeInput = {
  endDate?: string | null;
  preset?: string | null;
  startDate?: string | null;
};

function isDashboardDatePreset(value: string | null | undefined): value is DashboardDatePreset {
  return dashboardDatePresets.some((preset) => preset.value === value);
}

function normalizeIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : null;
}

export function resolveDashboardDateRange(input: DashboardDateRangeInput, referenceDate = new Date()) {
  const fallbackStart = startOfMonth(referenceDate);
  const fallbackEnd = endOfMonth(referenceDate);
  const explicitPreset = isDashboardDatePreset(input.preset) ? input.preset : null;
  const normalizedStart = normalizeIsoDate(input.startDate);
  const normalizedEnd = normalizeIsoDate(input.endDate);
  const preset = explicitPreset ?? (normalizedStart && normalizedEnd ? "custom" : "this-month");

  if (preset === "custom" && normalizedStart && normalizedEnd) {
    const [startDate, endDate] = [normalizedStart, normalizedEnd].sort();

    return {
      preset,
      startDate,
      endDate,
      label: `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`,
    };
  }

  const ranges: Record<Exclude<DashboardDatePreset, "custom">, { startDate: Date; endDate: Date }> = {
    "this-month": {
      startDate: fallbackStart,
      endDate: fallbackEnd,
    },
    "last-month": {
      startDate: startOfMonth(subMonths(referenceDate, 1)),
      endDate: endOfMonth(subMonths(referenceDate, 1)),
    },
    "last-3-months": {
      startDate: startOfMonth(subMonths(referenceDate, 2)),
      endDate: fallbackEnd,
    },
    "year-current": {
      startDate: startOfYear(referenceDate),
      endDate: endOfYear(referenceDate),
    },
  };

  const resolved = ranges[preset === "custom" ? "this-month" : preset];
  const startDate = format(resolved.startDate, "yyyy-MM-dd");
  const endDate = format(resolved.endDate, "yyyy-MM-dd");

  return {
    preset: preset === "custom" ? "this-month" : preset,
    startDate,
    endDate,
    label: `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`,
  };
}
