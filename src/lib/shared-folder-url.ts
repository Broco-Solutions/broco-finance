import { z } from "zod";

// ---------------------------------------------------------------------------
// Límites y default
// ---------------------------------------------------------------------------

export const SHARED_FOLDER_URL_MAX = 2048;
export const SHARED_FOLDER_LABEL_MAX = 120;
export const SHARED_FOLDER_LABEL_DEFAULT = "Abrir carpeta compartida";

// ---------------------------------------------------------------------------
// Normalización / validación de URL
// ---------------------------------------------------------------------------

/**
 * Devuelve la URL normalizada (con protocolo, pathname, query y fragment) o
 * `null` si no es una URL HTTPS absoluta y segura.
 *
 * Reglas:
 * - trim del valor.
 * - Debe parsear como URL absoluta.
 * - Protocolo exclusivamente `https:` (rechaza http:, javascript:, data:, etc.).
 * - Hostname no vacío y sin whitespace interno.
 * - Sin credenciales embebidas (user:pass@).
 * - Longitud máxima {@link SHARED_FOLDER_URL_MAX}.
 */
export function normalizeSharedFolderUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const candidate = raw.trim();
  if (!candidate) return null;
  if (candidate.length > SHARED_FOLDER_URL_MAX) return null;
  if (/\s/.test(candidate)) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  const hostname = parsed.hostname?.trim();
  if (!hostname) return null;
  if (parsed.username || parsed.password) return null;

  return parsed.toString();
}

export function assertValidSharedFolderUrl(raw: string | null | undefined): string {
  const normalized = normalizeSharedFolderUrl(raw);
  if (!normalized) {
    throw new Error(
      "El enlace debe ser una URL HTTPS válida (sin credenciales embebidas) y de menos de 2048 caracteres.",
    );
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Normalización de etiqueta
// ---------------------------------------------------------------------------

export function normalizeSharedFolderLabel(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return SHARED_FOLDER_LABEL_DEFAULT;
  if (trimmed.length > SHARED_FOLDER_LABEL_MAX) {
    throw new Error(
      `El texto visible para el cliente no puede superar los ${SHARED_FOLDER_LABEL_MAX} caracteres.`,
    );
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Schema de entrada (proyecto + url + etiqueta opcional)
// ---------------------------------------------------------------------------

export const sharedFolderInputSchema = z.object({
  projectId: z.string().min(1, "El proyecto es obligatorio."),
  url: z.string().trim().min(1, "El enlace es obligatorio."),
  label: z.string().trim().max(SHARED_FOLDER_LABEL_MAX).optional(),
});
