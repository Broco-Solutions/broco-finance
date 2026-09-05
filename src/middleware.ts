import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "broco_session";

const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/favicon.ico"];

function isMcpPath(pathname: string) {
  return (
    pathname === "/api/mcp" ||
    pathname === "/.well-known/oauth-protected-resource"
  );
}

function isPublicPortalPath(pathname: string) {
  return pathname === "/p" || pathname.startsWith("/p/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    isPublicPortalPath(pathname) ||
    isMcpPath(pathname)
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get(AUTH_COOKIE)?.value;

  if (!session) {
    if (isApiRequest) {
      return NextResponse.json({ error: "Sesion expirada o no autenticada." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
};
