function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.password) {
      url.password = "***";
    }
    return url.toString();
  } catch {
    if (rawUrl.length <= 12) return rawUrl;
    return rawUrl.slice(0, 12) + "...";
  }
}

function extractDbName(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\//, "");
    return path || null;
  } catch {
    return null;
  }
}

export function assertTestDatabase() {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "test") {
    throw new Error(
      `NODE_ENV debe ser "test" para operaciones destructivas. Valor actual: ${JSON.stringify(nodeEnv ?? "no definido")}`,
    );
  }

  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_TEST_DB;
  if (allowDestructive !== "true") {
    throw new Error(
      `ALLOW_DESTRUCTIVE_TEST_DB debe ser "true" para operaciones destructivas. Valor actual: ${JSON.stringify(allowDestructive ?? "no definido")}`,
    );
  }

  const testDbUrl = process.env.DATABASE_URL_TEST;
  if (!testDbUrl) {
    throw new Error(
      "DATABASE_URL_TEST no esta definida. Debe apuntar a una base de test aislada.",
    );
  }

  const prodDbUrl = process.env.DATABASE_URL;
  if (!prodDbUrl) {
    throw new Error(
      "DATABASE_URL no esta definida. Debe estar configurada aunque no se use para test, como proteccion adicional.",
    );
  }

  if (testDbUrl === prodDbUrl) {
    throw new Error(
      `DATABASE_URL_TEST es identica a DATABASE_URL (${redactUrl(testDbUrl)}). Deben ser bases distintas para proteger produccion.`,
    );
  }

  const testDbName = extractDbName(testDbUrl);
  if (testDbName && !testDbName.toLowerCase().includes("test")) {
    console.warn(
      `[test-db-guard] El nombre de la base de test (${testDbName}) no contiene "test". ` +
        "Verifica que no sea una base productiva.",
    );
  }

  return {
    testDbUrl,
    testDbName,
    nodeEnv,
  };
}
