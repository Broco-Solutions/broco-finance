import { withRoute } from "@/server/http";
import { resolveDashboardDateRange } from "@/lib/dashboard-date-range";
import { dashboardFilterSchema, getDashboard } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const dateRange = resolveDashboardDateRange({
    preset: params.preset ?? null,
    startDate: params.startDate ?? params.from ?? null,
    endDate: params.endDate ?? params.to ?? null,
  });
  const filters = dashboardFilterSchema.parse({
    from: dateRange.startDate,
    to: dateRange.endDate,
    clientId: params.clientId ?? null,
    projectId: params.projectId ?? null,
  });

  return withRoute(() => getDashboard(filters));
}
