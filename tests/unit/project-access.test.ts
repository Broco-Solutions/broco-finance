import { describe, it, expect, beforeAll } from "vitest";
import {
  assertHexSecret,
  slugify,
  buildSlug,
  makeUniqueSlug,
  hashPassword,
  verifyPassword,
  encryptPassword,
  decryptPassword,
  signSession,
  verifySession,
  generatePassword,
  isValidManualPassword,
  MIN_MANUAL_PASSWORD_LENGTH,
  AUTO_PASSWORD_LENGTH,
} from "@/lib/project-access-crypto";

beforeAll(() => {
  process.env.PROJECT_SHARE_ENCRYPTION_KEY = "a".repeat(64);
  process.env.PROJECT_SHARE_SESSION_SECRET = "b".repeat(64);
});

describe("assertHexSecret", () => {
  it("acepta 64 caracteres hex", () => {
    expect(() => assertHexSecret("a".repeat(64), "KEY")).not.toThrow();
  });
  it("rechaza ausente / corto / no hex", () => {
    expect(() => assertHexSecret(undefined, "KEY")).toThrow(/64 caracteres/);
    expect(() => assertHexSecret("abc", "KEY")).toThrow(/64 caracteres/);
    expect(() => assertHexSecret("z".repeat(64), "KEY")).toThrow(/64 caracteres/);
  });
});

describe("slugify / buildSlug", () => {
  it("normaliza acentos, espacios y mayúsculas", () => {
    expect(slugify("Import Skate")).toBe("import-skate");
    expect(slugify("Sistema de Gestión")).toBe("sistema-de-gestion");
    expect(slugify("  Café   Mañana  ")).toBe("cafe-manana");
  });
  it("buildSlug combina cliente + proyecto", () => {
    expect(buildSlug("Import Skate", "Sistema de Gestión")).toBe(
      "import-skate-sistema-de-gestion",
    );
  });
  it("fallback si no quedan caracteres", () => {
    expect(buildSlug("!!!", "???")).toBe("cliente-proyecto");
  });
});

describe("makeUniqueSlug", () => {
  it("devuelve el base si está libre", () => {
    expect(makeUniqueSlug("import-skate-x", () => false)).toBe("import-skate-x");
  });
  it("resuelve colisiones con -2, -3…", () => {
    const taken = new Set(["import-skate-x", "import-skate-x-2"]);
    expect(makeUniqueSlug("import-skate-x", (s) => taken.has(s))).toBe("import-skate-x-3");
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifica contraseña correcta", async () => {
    const stored = await hashPassword("clave-super-segura-123");
    expect(stored).not.toBe("clave-super-segura-123");
    expect(stored).toContain(":");
    expect(await verifyPassword("clave-super-segura-123", stored)).toBe(true);
  });
  it("rechaza contraseña incorrecta", async () => {
    const stored = await hashPassword("clave-super-segura-123");
    expect(await verifyPassword("otra-clave", stored)).toBe(false);
  });
});

describe("encryptPassword / decryptPassword", () => {
  it("round-trip y no almacena plaintext", () => {
    const stored = encryptPassword("mi-password-secreta");
    expect(stored).not.toContain("mi-password-secreta");
    expect(decryptPassword(stored)).toBe("mi-password-secreta");
  });
  it("detecta manipulación (tag inválido)", () => {
    const stored = encryptPassword("abc");
    const tampered = stored.slice(0, -2) + (stored.endsWith("00") ? "11" : "00");
    expect(() => decryptPassword(tampered)).toThrow();
  });
});

describe("signSession / verifySession", () => {
  const now = 1_800_000_000;
  it("firma y verifica sesión válida", () => {
    const signed = signSession({ linkId: "l1", accessVersion: 3, expiresAt: now + 600 });
    const parsed = verifySession(signed, now);
    expect(parsed).toEqual({ linkId: "l1", accessVersion: 3, expiresAt: now + 600 });
  });
  it("rechaza firma inválida", () => {
    const signed = signSession({ linkId: "l1", accessVersion: 3, expiresAt: now + 600 });
    const tampered = signed.slice(0, -2) + (signed.endsWith("00") ? "11" : "00");
    expect(verifySession(tampered, now)).toBeNull();
  });
  it("rechaza sesión expirada (validación server-side)", () => {
    const signed = signSession({ linkId: "l1", accessVersion: 3, expiresAt: now - 10 });
    expect(verifySession(signed, now)).toBeNull();
  });
  it("rechaza payload malformado", () => {
    expect(verifySession("no-valid", now)).toBeNull();
    expect(verifySession(null, now)).toBeNull();
  });
});

describe("generatePassword", () => {
  it("genera 16 caracteres sin ambiguos", () => {
    const pass = generatePassword();
    expect(pass).toHaveLength(AUTO_PASSWORD_LENGTH);
    expect(pass).toMatch(/^[A-HJKMNP-Za-hjkmnp-z2-9]+$/);
  });
  it("constante mínima manual = 6", () => {
    expect(MIN_MANUAL_PASSWORD_LENGTH).toBe(6);
  });
});

describe("isValidManualPassword", () => {
  it("5 chars inválida", () => {
    expect(isValidManualPassword("a1b2c")).toBe(false);
  });
  it("6 chars con letra+número válida", () => {
    expect(isValidManualPassword("cliente1")).toBe(true);
    expect(isValidManualPassword("Broco26")).toBe(true);
    expect(isValidManualPassword("vimarti8")).toBe(true);
  });
  it("falta número inválida", () => {
    expect(isValidManualPassword("cliente")).toBe(false);
  });
  it("falta letra inválida", () => {
    expect(isValidManualPassword("123456")).toBe(false);
  });
});