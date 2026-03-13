import { readJson, withRoute } from "@/server/http";
import { createRecurring, listRecurring, recurringFilterSchema, recurringInputSchema } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = recurringFilterSchema.parse({
    clientId: params.clientId ?? null,
    projectId: params.projectId ?? null,
    active: params.active ?? null,
  });

  return withRoute(() => listRecurring(filters));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, recurringInputSchema);
    return createRecurring(input);
  });
}
