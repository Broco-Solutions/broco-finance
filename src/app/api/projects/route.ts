import { readJson, withRoute } from "@/server/http";
import { createProject, listProjects, projectInputSchema } from "@/server/services/finance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return withRoute(() =>
    listProjects({
      clientId: searchParams.get("clientId"),
      status: searchParams.get("status"),
    }),
  );
}

export async function POST(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, projectInputSchema);
    return createProject(input);
  });
}
