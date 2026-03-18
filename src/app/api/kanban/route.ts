import { readJson, withRoute } from "@/server/http";
import { getKanbanBoard, kanbanBoardActionSchema, mutateKanbanBoard } from "@/server/services/kanban";

export async function GET() {
  return withRoute(() => getKanbanBoard());
}

export async function PUT(request: Request) {
  return withRoute(async () => {
    const contentType = request.headers.get("content-type") ?? "unknown";
    const contentLength = request.headers.get("content-length") ?? "unknown";
    let stage: "read_json" | "mutate" = "read_json";

    console.info("[kanban.api]", {
      method: request.method,
      endpoint: "/api/kanban",
      stage,
      contentType,
      contentLength,
    });

    try {
      const input = await readJson(request, kanbanBoardActionSchema);
      stage = "mutate";

      console.info("[kanban.api]", {
        method: request.method,
        endpoint: "/api/kanban",
        stage,
        action: input.action,
      });

      const board = await mutateKanbanBoard(input);

      console.info("[kanban.api]", {
        method: request.method,
        endpoint: "/api/kanban",
        stage: "success",
        action: input.action,
      });

      return board;
    } catch (error) {
      console.warn("[kanban.api]", {
        method: request.method,
        endpoint: "/api/kanban",
        stage,
        contentType,
        contentLength,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  });
}
