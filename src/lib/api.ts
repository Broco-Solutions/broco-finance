import type { ApiEnvelope } from "@/lib/types";

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as ApiEnvelope<T> & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "La operación falló.");
  }

  return payload.data;
}
