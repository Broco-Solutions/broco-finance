import { ZodSchema } from "zod";
import { AppError, getErrorMessage, logServerError } from "@/server/errors";

function getRequestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  const path = getRequestPath(request);
  const isKanbanRequest = path === "/api/kanban";
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    const isEmptyBody = contentLength === "0";
    const message = isEmptyBody ? "Body JSON ausente." : "Body JSON inválido.";

    if (isKanbanRequest) {
      console.warn("[kanban.readJson]", {
        method: request.method,
        path,
        contentType: contentType || "unknown",
        contentLength: contentLength ?? "unknown",
        reason: isEmptyBody ? "empty_body" : "invalid_json",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }

    throw new AppError(message, 400);
  }

  if (isKanbanRequest) {
    console.info("[kanban.readJson]", {
      method: request.method,
      path,
      contentType: contentType || "unknown",
      contentLength: contentLength ?? "unknown",
      payloadType: Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload,
    });
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    if (isKanbanRequest) {
      console.warn("[kanban.readJson]", {
        method: request.method,
        path,
        reason: "zod_validation",
        issue: result.error.issues[0]?.message ?? "Payload inválido",
      });
    }
    throw new AppError(result.error.issues[0]?.message ?? "Payload inválido", 422);
  }

  return result.data;
}

export async function withRoute<T>(handler: () => Promise<T>) {
  try {
    const data = await handler();
    return Response.json({ data });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    if (!(error instanceof AppError)) {
      logServerError("api.route", error, { status });
    }
    return Response.json({ error: getErrorMessage(error) }, { status });
  }
}
