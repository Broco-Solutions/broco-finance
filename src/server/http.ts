import { ZodSchema } from "zod";
import { AppError, getErrorMessage, logServerError } from "@/server/errors";

function getRequestPath(request: Request) {
  try { return new URL(request.url).pathname; } catch { return request.url; }
}

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  const path = getRequestPath(request);
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    const isEmptyBody = contentLength === "0";
    throw new AppError(isEmptyBody ? "Body JSON ausente." : "Body JSON invalido.", 400);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Payload invalido", 422);
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
