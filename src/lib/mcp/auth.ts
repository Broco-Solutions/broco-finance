import type { AuthInfo } from "@modelcontextprotocol/server";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import type { AuthConfig } from "@/lib/mcp/config";

function getJwksUrl(issuer: string): URL {
  return new URL(".well-known/jwks.json", issuer);
}

function parseScopes(payload: Record<string, unknown>): string[] {
  const scopes = new Set<string>();
  if (typeof payload.scope === "string") {
    for (const scope of payload.scope.split(/\s+/)) {
      if (scope) scopes.add(scope);
    }
  }
  if (Array.isArray(payload.permissions)) {
    for (const permission of payload.permissions) {
      if (typeof permission === "string" && permission) scopes.add(permission);
    }
  }
  return [...scopes];
}

export type TokenVerifier = (
  request: Request,
  bearerToken?: string,
) => Promise<AuthInfo | undefined>;

/** Verifies an Auth0 access token and applies the application allowlist. */
export function makeTokenVerifier(
  config: AuthConfig,
  getKey: JWTVerifyGetKey = createRemoteJWKSet(getJwksUrl(config.issuer)),
): TokenVerifier {
  return async (_request, bearerToken) => {
    if (!bearerToken) return undefined;

    try {
      const { payload } = await jwtVerify(bearerToken, getKey, {
        algorithms: ["RS256"],
        issuer: config.issuer,
        audience: config.audience,
        requiredClaims: ["sub", "exp"],
        clockTolerance: 5,
      });

      const subject = typeof payload.sub === "string" ? payload.sub : "";
      const emailValue = payload[config.emailClaim];
      const email =
        typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
      const emailVerified = payload[config.emailVerifiedClaim] === true;

      const subjectAllowed = config.allowedSubjects.has(subject);
      const emailAllowed =
        emailVerified && email.length > 0 && config.allowedEmails.has(email);
      if (!subjectAllowed && !emailAllowed) return undefined;

      const clientId =
        typeof payload.azp === "string"
          ? payload.azp
          : typeof payload.client_id === "string"
            ? payload.client_id
            : subject;

      return {
        token: bearerToken,
        clientId,
        scopes: parseScopes(payload as Record<string, unknown>),
        expiresAt: payload.exp,
        extra: { sub: subject, email: email || undefined },
      };
    } catch {
      return undefined;
    }
  };
}
