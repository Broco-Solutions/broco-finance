import { readJson, withRoute } from "@/server/http";
import { createIncome, incomeFilterSchema, incomeInputSchema, listIncomes } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = incomeFilterSchema.parse({
    projectId: params.projectId ?? null,
    clientId: params.clientId ?? null,
    status: params.status ?? null,
    from: params.from ?? null,
    to: params.to ?? null,
  });

  return withRoute(() => listIncomes(filters));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, incomeInputSchema);
    return createIncome(input);
  });
}
