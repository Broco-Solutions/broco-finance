import { withRoute } from "@/server/http";
import { listScheduledExpenses, scheduledExpenseFilterSchema } from "@/server/services/finance";

function parseBooleanParam(value: string | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = scheduledExpenseFilterSchema.parse({
    status: params.get("status"),
    dueAfter: params.get("dueAfter"),
    dueBefore: params.get("dueBefore"),
    currentMonth: parseBooleanParam(params.get("currentMonth")),
    includeOverdue: parseBooleanParam(params.get("includeOverdue")),
  });

  return withRoute(() => listScheduledExpenses(filters));
}
