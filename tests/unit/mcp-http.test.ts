import type { AuthInfo } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";
import type { EnabledMcpConfig, McpConfig } from "@/lib/mcp/config";
import {
  createMcpHttpHandler,
  createProtectedResourceMetadataHandlers,
} from "@/server/mcp/http";

const enabled: EnabledMcpConfig = {
  status: "ok",
  resourceUrl: "https://broco.example/api/mcp",
  requiredScope: "mcp:read",
  auth: {
    issuer: "https://example.auth0.com/",
    audience: "https://broco.example/api/mcp",
    allowedSubjects: new Set(["auth0|allowed"]),
    allowedEmails: new Set(),
    emailClaim: "email",
    emailVerifiedClaim: "email_verified",
  },
};

const authInfo = (scopes: string[]): AuthInfo => ({
  token: "token",
  clientId: "chatgpt",
  scopes,
  expiresAt: Math.floor(Date.now() / 1000) + 60,
});

function handler(config: McpConfig, auth?: AuthInfo) {
  const protocol = vi.fn(async () => new Response("protocol-ok"));
  const tokenVerifier = vi.fn(() => async () => auth);
  return {
    protocol,
    tokenVerifier,
    run: createMcpHttpHandler({
      readConfig: () => config,
      protocolHandler: protocol,
      tokenVerifier,
    }),
  };
}

describe("HTTP MCP protegido", () => {
  it.each(["disabled", "killed"] as const)(
    "devuelve 404 y no autentica cuando está %s",
    async (status) => {
      const test = handler({ status });
      const response = await test.run(new Request(enabled.resourceUrl));
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(test.tokenVerifier).not.toHaveBeenCalled();
      expect(test.protocol).not.toHaveBeenCalled();
    },
  );

  it("devuelve 503 genérico cuando la configuración está incompleta", async () => {
    const test = handler({ status: "misconfigured", reason: "invalid_issuer" });
    const response = await test.run(new Request(enabled.resourceUrl));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Service unavailable" });
  });

  it("desafía con metadata RFC 9728 cuando falta o no vale el JWT", async () => {
    const test = handler(enabled);
    const response = await test.run(new Request(enabled.resourceUrl));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://broco.example/.well-known/oauth-protected-resource"',
    );
    expect(test.protocol).not.toHaveBeenCalled();
  });

  it("rechaza scope incorrecto con 403", async () => {
    const test = handler(enabled, authInfo(["profile"]));
    const response = await test.run(
      new Request(enabled.resourceUrl, {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("www-authenticate")).toContain("insufficient_scope");
    expect(test.protocol).not.toHaveBeenCalled();
  });

  it("solo invoca el protocolo con identidad permitida y mcp:read", async () => {
    const test = handler(enabled, authInfo(["mcp:read"]));
    const response = await test.run(
      new Request(enabled.resourceUrl, {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("protocol-ok");
    expect(test.protocol).toHaveBeenCalledOnce();
  });
});

describe("Protected Resource Metadata", () => {
  it("queda oculta con el kill switch", () => {
    const routes = createProtectedResourceMetadataHandlers(() => ({ status: "killed" }));
    expect(routes.GET().status).toBe(404);
    expect(routes.OPTIONS().status).toBe(404);
  });

  it("publica issuer, resource, scope, bearer header y CORS", async () => {
    const routes = createProtectedResourceMetadataHandlers(() => enabled);
    const response = routes.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(response.json()).resolves.toMatchObject({
      resource: enabled.resourceUrl,
      authorization_servers: [enabled.auth.issuer],
      scopes_supported: ["mcp:read"],
      bearer_methods_supported: ["header"],
    });
    expect(routes.OPTIONS().status).toBe(204);
  });
});
