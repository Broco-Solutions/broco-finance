import { readJson, withRoute } from "@/server/http";
import { createExpense, expenseFilterSchema, expenseInputSchema, listExpenses } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = expenseFilterSchema.parse({
    status: params.status ?? null,
    categoryId: params.categoryId ?? null,
    type: params.type ?? null,
    projectId: params.projectId ?? null,
    from: params.from ?? null,
    to: params.to ?? null,
  });

  return withRoute(() => listExpenses(filters));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, expenseInputSchema);
    return createExpense(input);
  });
}
