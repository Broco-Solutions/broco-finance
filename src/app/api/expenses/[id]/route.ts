import { readJson, withRoute } from "@/server/http";
import { deleteExpense, expenseInputSchema, updateExpense } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, expenseInputSchema);
    return updateExpense(params.id, input);
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    await deleteExpense(params.id);
    return { ok: true };
  });
}
