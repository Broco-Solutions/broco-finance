import { readJson, withRoute } from "@/server/http";
import { recurringExpenseInputSchema, updateRecurringExpense } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, recurringExpenseInputSchema);
    return updateRecurringExpense(params.id, input);
  });
}
