import { readJson, withRoute } from "@/server/http";
import { scheduledPaymentInputSchema, updateScheduledPayment } from "@/server/services/finance";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, scheduledPaymentInputSchema);
    return updateScheduledPayment(params.id, input);
  });
}
