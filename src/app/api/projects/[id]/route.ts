import { readJson, withRoute } from "@/server/http";
import { deleteProject, getProjectDetail, projectInputSchema, updateProject } from "@/server/services/finance";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return withRoute(() => getProjectDetail(params.id));
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, projectInputSchema);
    return updateProject(params.id, input);
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    await deleteProject(params.id);
    return { ok: true };
  });
}
