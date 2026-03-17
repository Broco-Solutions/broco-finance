import { readJson, withRoute } from "@/server/http";
import { getKanbanBoard, kanbanBoardActionSchema, mutateKanbanBoard } from "@/server/services/kanban";

export async function GET() {
  return withRoute(() => getKanbanBoard());
}

export async function PUT(request: Request) {
  return withRoute(async () => {
    const input = await readJson(request, kanbanBoardActionSchema);
    return mutateKanbanBoard(input);
  });
}
