import { readJson, withRoute } from "@/server/http";
import { distributionInputSchema, getDistributionPage, updateDistribution } from "@/server/services/finance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return withRoute(() => getDistributionPage(searchParams.get("month")));
}

export async function PUT(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, distributionInputSchema);
    await updateDistribution(input);
    return getDistributionPage(null);
  });
}
