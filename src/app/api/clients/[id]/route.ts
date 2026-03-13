import { readJson, withRoute } from "@/server/http";
import { clientInputSchema, deleteClient, getClientDetail, updateClient } from "@/server/services/finance";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return withRoute(() => getClientDetail(params.id));
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    const input = await readJson(request, clientInputSchema);
    return updateClient(params.id, input);
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    await deleteClient(params.id);
    return { ok: true };
  });
}
