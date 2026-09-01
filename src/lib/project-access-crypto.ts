import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// ---------------------------------------------------------------------------
// Secrets (64 hex chars)
// ---------------------------------------------------------------------------

export function assertHexSecret(value: string | undefined, name: string): void {
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} debe ser un secreto de 64 caracteres hexadecimales (openssl rand -hex 32).`);
  }
}

function encryptionKey(): Buffer {
  const secret = process.env.PROJECT_SHARE_ENCRYPTION_KEY;
  assertHexSecret(secret, "PROJECT_SHARE_ENCRYPTION_KEY");
  return Buffer.from(secret!, "hex");
}

function sessionSecret(): string {
  const secret = process.env.PROJECT_SHARE_SESSION_SECRET;
  assertHexSecret(secret, "PROJECT_SHARE_SESSION_SECRET");
  return secret!;
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== 64) return false;
  const actual = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------------------
// Password encryption (AES-256-GCM) — internal recovery only
// ---------------------------------------------------------------------------

export function encryptPassword(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptPassword(stored: string): string {
  const [ivHex, tagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Password cifrada inválida.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

// ---------------------------------------------------------------------------
// Stateless client session (HMAC)
// ---------------------------------------------------------------------------

export type SessionPayload = {
  linkId: string;
  accessVersion: number;
  expiresAt: number; // epoch seconds
};

export function signSession(payload: SessionPayload): string {
  const body = `${payload.linkId}.${payload.accessVersion}.${payload.expiresAt}`;
  const signature = createHmac("sha256", sessionSecret()).update(body).digest("hex");
  return `${body}.${signature}`;
}

export function verifySession(
  payload: string | null | undefined,
  now: number = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4) return null;

  const [linkId, accessVersionStr, expiresAtStr, signature] = parts;
  const accessVersion = Number(accessVersionStr);
  const expiresAt = Number(expiresAtStr);
  if (!Number.isInteger(accessVersion) || !Number.isInteger(expiresAt)) return null;

  const body = `${linkId}.${accessVersion}.${expiresAt}`;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (now > expiresAt) return null;

  return { linkId, accessVersion, expiresAt };
}

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSlug(clientName: string, projectName: string): string {
  const clientPart = slugify(clientName) || "cliente";
  const projectPart = slugify(projectName) || "proyecto";
  return `${clientPart}-${projectPart}`;
}

export function makeUniqueSlug(
  base: string,
  isTaken: (slug: string) => boolean,
  maxAttempts = 10000,
): string {
  if (!isTaken(base)) return base;
  for (let i = 2; i < maxAttempts; i++) {
    const candidate = `${base}-${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error("No se pudo generar un slug único.");
}

// ---------------------------------------------------------------------------
// Password generation
// ---------------------------------------------------------------------------

// Charset without visually ambiguous characters (0, O, 1, l, I, L).
const PASSWORD_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARSET[randomInt(0, PASSWORD_CHARSET.length)];
  }
  return out;
}

export const MIN_MANUAL_PASSWORD_LENGTH = 6;
export const AUTO_PASSWORD_LENGTH = 16;

export function isValidManualPassword(password: string): boolean {
  return (
    password.length >= MIN_MANUAL_PASSWORD_LENGTH &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}