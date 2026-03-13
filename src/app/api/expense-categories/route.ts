import { readJson, withRoute } from "@/server/http";
import { createExpenseCategory, expenseCategoryInputSchema, listExpenseCategories } from "@/server/services/finance";

export async function GET() {
  return withRoute(() => listExpenseCategories());
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, expenseCategoryInputSchema);
    return createExpenseCategory(input);
  });
}
