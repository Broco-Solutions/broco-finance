import { readJson, withRoute } from "@/server/http";
import {
  deleteExpenseCategory,
  expenseCategoryInputSchema,
  updateExpenseCategory,
} from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, expenseCategoryInputSchema);
    return updateExpenseCategory(params.id, input);
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    await deleteExpenseCategory(params.id);
    return { ok: true };
  });
}
