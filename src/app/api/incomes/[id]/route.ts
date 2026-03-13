import { readJson, withRoute } from "@/server/http";
import { deleteIncome, incomeInputSchema, updateIncome } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, incomeInputSchema);
    return updateIncome(params.id, input);
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    await deleteIncome(params.id);
    return { ok: true };
  });
}
