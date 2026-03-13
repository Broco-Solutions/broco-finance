import { readJson, withRoute } from "@/server/http";
import { scheduledExpenseInputSchema, updateScheduledExpense } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, scheduledExpenseInputSchema);
    return updateScheduledExpense(params.id, input);
  });
}
