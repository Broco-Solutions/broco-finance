import { readJson, withRoute } from "@/server/http";
import { createSalary, listSalary, salaryFilterSchema, salaryInputSchema } from "@/server/services/finance";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = salaryFilterSchema.parse({
    month: params.month ?? null,
    person: params.person ?? null,
  });

  return withRoute(() => listSalary(filters));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, salaryInputSchema);
    return createSalary(input);
  });
}
