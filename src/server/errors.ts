import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}

function getErrorDetails(error: unknown) {
  if (error instanceof AppError) {
    return {
      type: "AppError",
      message: error.message,
      status: error.status,
      stack: error.stack,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      type: "PrismaClientKnownRequestError",
      code: error.code,
      message: error.message,
      meta: error.meta ?? null,
      clientVersion: error.clientVersion,
      stack: error.stack,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      type: "PrismaClientValidationError",
      message: error.message,
      stack: error.stack,
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      type: "PrismaClientInitializationError",
      message: error.message,
      errorCode: error.errorCode ?? null,
      clientVersion: error.clientVersion,
      stack: error.stack,
    };
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      type: "PrismaClientUnknownRequestError",
      message: error.message,
      clientVersion: error.clientVersion,
      stack: error.stack,
    };
  }

  if (error instanceof ZodError) {
    return {
      type: "ZodError",
      message: error.message,
      issues: error.issues,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: typeof error,
    value: error,
  };
}

export function logServerError(context: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[${context}]`, {
    ...(extra ?? {}),
    ...getErrorDetails(error),
  });
}
