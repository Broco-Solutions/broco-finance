import type { ApiEnvelope } from "@/lib/types";

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const rawBody = await response.text();
  let payload: (ApiEnvelope<T> & { error?: string }) | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as ApiEnvelope<T> & { error?: string };
    } catch {
      throw new Error(response.ok ? "La API devolvió una respuesta inválida." : "La API devolvió un error inválido.");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? "La operación falló.");
  }

  return (payload?.data ?? null) as T;
}
