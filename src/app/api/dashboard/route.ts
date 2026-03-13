import { withRoute } from "@/server/http";
import { dashboardFilterSchema, getDashboard } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = dashboardFilterSchema.parse({
    from: params.from ?? null,
    to: params.to ?? null,
    clientId: params.clientId ?? null,
    projectId: params.projectId ?? null,
  });

  return withRoute(() => getDashboard(filters));
}
