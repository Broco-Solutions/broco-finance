import { readJson, withRoute } from "@/server/http";
import { recurringIncomeUpdateSchema, updateRecurringIncome } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, recurringIncomeUpdateSchema);
    return updateRecurringIncome(params.id, input);
  });
}
