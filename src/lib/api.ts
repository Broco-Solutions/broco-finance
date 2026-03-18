import type { ApiEnvelope } from "@/lib/types";

function getRequestPath(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return `${input.pathname}${input.search}`;
  }

  return `${input.url}`;
}

function isJsonContentType(contentType: string) {
  return contentType.includes("application/json") || contentType.includes("+json");
}

function isHtmlContentType(contentType: string) {
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function looksLikeJson(body: string) {
  return body.startsWith("{") || body.startsWith("[");
}

function looksLikeHtml(body: string) {
  return body.startsWith("<!doctype html") || body.startsWith("<html") || body.startsWith("<body");
}

function truncateText(value: string, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const requestPath = getRequestPath(input);
  const isKanbanRequest = requestPath.startsWith("/api/kanban");
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const rawBody = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const trimmedBody = rawBody.trim();
  const hasBody = trimmedBody.length > 0;
  const shouldParseJson = hasBody && (isJsonContentType(contentType) || looksLikeJson(trimmedBody));
  let payload: (ApiEnvelope<T> & { error?: string }) | null = null;
  let parsedAsJson = false;
  let invalidJson = false;

  if (shouldParseJson) {
    try {
      payload = JSON.parse(trimmedBody) as ApiEnvelope<T> & { error?: string };
      parsedAsJson = true;
    } catch {
      invalidJson = true;
    }
  }

  if (isKanbanRequest) {
    console.info("[kanban.client]", {
      endpoint: requestPath,
      method: init?.method ?? "GET",
      status: response.status,
      ok: response.ok,
      contentType: contentType || "unknown",
      bodyLength: rawBody.length,
      parsedAsJson,
      invalidJson,
    });
  }

  if (!response.ok) {
    if (isObjectPayload(payload) && typeof payload.error === "string" && payload.error.trim().length > 0) {
      throw new Error(payload.error);
    }

    if (!hasBody) {
      throw new Error(`La API devolvió un error HTTP ${response.status} sin body.`);
    }

    if (invalidJson) {
      throw new Error(`La API devolvió JSON inválido (HTTP ${response.status}).`);
    }

    if (isHtmlContentType(contentType) || looksLikeHtml(trimmedBody.toLowerCase())) {
      throw new Error("La API devolvió HTML en lugar de JSON. Revisá si hubo redirect, login o un error del servidor.");
    }

    throw new Error(truncateText(trimmedBody));
  }

  if (!hasBody) {
    throw new Error("La API devolvió una respuesta exitosa sin body.");
  }

  if (invalidJson || !parsedAsJson) {
    if (isHtmlContentType(contentType) || looksLikeHtml(trimmedBody.toLowerCase())) {
      throw new Error("La API devolvió HTML en lugar de JSON.");
    }

    throw new Error("La API devolvió una respuesta inválida.");
  }

  if (!isObjectPayload(payload) || !("data" in payload)) {
    throw new Error("La API devolvió una respuesta exitosa sin el campo data.");
  }

  return payload.data as T;
}
