import { withRoute } from "@/server/http";
import { listScheduledPayments, scheduledFilterSchema } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = scheduledFilterSchema.parse({
    status: params.status ?? null,
    type: params.type ?? null,
    from: params.from ?? null,
    to: params.to ?? null,
    clientId: params.clientId ?? null,
    projectId: params.projectId ?? null,
  });

  return withRoute(() => listScheduledPayments(filters));
}
