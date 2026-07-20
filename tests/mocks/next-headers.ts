export function cookies() {
  return {
    get: () => ({ value: "ok" }),
    set: () => {},
    delete: () => {},
  } as unknown as ReturnType<typeof import("next/headers")["cookies"]>;
}
