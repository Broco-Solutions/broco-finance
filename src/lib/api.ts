async function getRequestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  return input instanceof URL ? `${input.pathname}${input.search}` : `${(input as Request).url}`;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const rawBody = await response.text();
  const trimmedBody = rawBody.trim();

  if (!response.ok) {
    let payload: { error?: string } | null = null;
    try { payload = JSON.parse(trimmedBody); } catch { /* not JSON */ }
    if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
      throw new Error(payload.error);
    }
    if (!trimmedBody) throw new Error(`La API devolvio un error HTTP ${response.status} sin body.`);
    throw new Error(trimmedBody);
  }

  if (!trimmedBody) throw new Error("La API devolvio una respuesta exitosa sin body.");

  let payload: { data?: T } | null = null;
  try { payload = JSON.parse(trimmedBody); } catch {
    throw new Error("La API devolvio una respuesta invalida.");
  }

  if (!payload || !("data" in payload)) {
    throw new Error("La API devolvio una respuesta exitosa sin el campo data.");
  }

  return payload.data as T;
}
