import { ZodSchema } from "zod";
import { AppError, getErrorMessage } from "@/server/errors";

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  const payload = await request.json();
  const result = schema.safeParse(payload);

  if (!result.success) {
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
    return Response.json({ error: getErrorMessage(error) }, { status });
  }
}
