import { readJson, withRoute } from "@/server/http";
import {
  createRecurringIncome,
  listRecurringIncomes,
  recurringIncomeFilterSchema,
  recurringIncomeInputSchema,
} from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = recurringIncomeFilterSchema.parse({
    active: params.active ?? null,
  });

  return withRoute(() => listRecurringIncomes(filters));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, recurringIncomeInputSchema);
    return createRecurringIncome(input);
  });
}
