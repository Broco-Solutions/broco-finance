import { readJson, withRoute } from "@/server/http";
import { clientInputSchema } from "@/server/services/finance";
import { createClient, listClients } from "@/server/services/finance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return withRoute(() => listClients(searchParams.get("search")));
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, clientInputSchema);
    return createClient(input);
  });
}
