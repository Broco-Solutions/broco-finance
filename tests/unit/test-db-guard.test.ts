import { describe, it, expect, beforeEach } from "vitest";
import { assertTestDatabase } from "@/lib/test-db-guard";

const VALID_ENV = {
  NODE_ENV: "test",
  ALLOW_DESTRUCTIVE_TEST_DB: "true",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/prod_db",
  DATABASE_URL_TEST: "postgresql://broco_test:broco_test@localhost:5433/broco_finance_test",
};

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  setEnv(VALID_ENV);
});

describe("assertTestDatabase", () => {
  it("acepta una configuracion de test valida", () => {
    const result = assertTestDatabase();
    expect(result.nodeEnv).toBe("test");
    expect(result.testDbUrl).toBe(VALID_ENV.DATABASE_URL_TEST);
    expect(result.testDbName).toBe("broco_finance_test");
  });

  it("rechaza si falta DATABASE_URL_TEST", () => {
    setEnv({ DATABASE_URL_TEST: undefined });
    expect(() => assertTestDatabase()).toThrow("DATABASE_URL_TEST");
  });

  it("rechaza si falta DATABASE_URL", () => {
    setEnv({ DATABASE_URL: undefined });
    expect(() => assertTestDatabase()).toThrow("DATABASE_URL");
  });

  it("rechaza si ambas URLs son iguales", () => {
    setEnv({ DATABASE_URL_TEST: VALID_ENV.DATABASE_URL });
    expect(() => assertTestDatabase()).toThrow("identica");
  });

  it("rechaza si falta ALLOW_DESTRUCTIVE_TEST_DB=true", () => {
    setEnv({ ALLOW_DESTRUCTIVE_TEST_DB: undefined });
    expect(() => assertTestDatabase()).toThrow("ALLOW_DESTRUCTIVE_TEST_DB");
  });

  it("rechaza ALLOW_DESTRUCTIVE_TEST_DB con valor distinto de true", () => {
    setEnv({ ALLOW_DESTRUCTIVE_TEST_DB: "false" });
    expect(() => assertTestDatabase()).toThrow("ALLOW_DESTRUCTIVE_TEST_DB");
  });

  it("rechaza si no esta en entorno de test", () => {
    setEnv({ NODE_ENV: "production" });
    expect(() => assertTestDatabase()).toThrow("NODE_ENV");
  });

  it("rechaza si NODE_ENV no esta definido", () => {
    setEnv({ NODE_ENV: undefined });
    expect(() => assertTestDatabase()).toThrow("NODE_ENV");
  });

  it("no expone credenciales completas en el mensaje de error", () => {
    const secretPassword = "super-secret-password-123";
    const urlWithSecret = `postgresql://admin:${secretPassword}@localhost:5433/some_db`;
    setEnv({
      DATABASE_URL: urlWithSecret,
      DATABASE_URL_TEST: urlWithSecret, // son identicas -> dispara la comparacion
    });
    let message = "";
    try {
      assertTestDatabase();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain(secretPassword);
    expect(message).toContain("***");
    expect(message).toContain("identica");
  });

  it("advierte si el nombre de la base de test no contiene test", () => {
    const warnSpy = { called: false };
    const originalWarn = console.warn;
    console.warn = (msg: string) => {
      if (msg.includes("test-db-guard")) warnSpy.called = true;
    };

    setEnv({
      DATABASE_URL_TEST: "postgresql://broco_test:broco_test@localhost:5433/production_clone",
    });

    const result = assertTestDatabase();
    expect(result.testDbName).toBe("production_clone");

    console.warn = originalWarn;
    expect(warnSpy.called).toBe(true);
  });
});
