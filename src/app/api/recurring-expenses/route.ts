import { readJson, withRoute } from "@/server/http";
import {
  createRecurringExpense,
  listRecurringExpenses,
  recurringExpenseFilterSchema,
  recurringExpenseInputSchema,
} from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = recurringExpenseFilterSchema.parse({
    categoryId: params.categoryId ?? null,
    active: params.active ?? null,
  });

  return withRoute(() => listRecurringExpenses(filters));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, recurringExpenseInputSchema);
    return createRecurringExpense(input);
  });
}
