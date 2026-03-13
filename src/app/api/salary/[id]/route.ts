import { withRoute } from "@/server/http";
import { deleteSalary } from "@/server/services/finance";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return withRoute(async () => {
    await deleteSalary(params.id);
    return { ok: true };
  });
}
