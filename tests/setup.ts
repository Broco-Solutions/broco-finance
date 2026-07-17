import { beforeAll } from "vitest";

beforeAll(() => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `NODE_ENV debe ser "test" para ejecutar tests. Valor actual: ${JSON.stringify(process.env.NODE_ENV)}`,
    );
  }
});
