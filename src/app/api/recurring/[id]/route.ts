import { readJson, withRoute } from "@/server/http";
import { recurringInputSchema, updateRecurring } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, recurringInputSchema);
    return updateRecurring(params.id, input);
  });
}
