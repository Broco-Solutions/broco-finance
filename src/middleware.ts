import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "broco_session";

const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");
  const isKanbanRequest = pathname === "/api/kanban";

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    if (isKanbanRequest) {
      console.info("[kanban.middleware]", {
        method: request.method,
        pathname,
        action: "public_next",
      });
    }
    return NextResponse.next();
  }

  const session = request.cookies.get(AUTH_COOKIE)?.value;

  if (!session) {
    if (isApiRequest) {
      if (isKanbanRequest) {
        console.warn("[kanban.middleware]", {
          method: request.method,
          pathname,
          action: "unauthorized_json",
        });
      }

      return NextResponse.json({ error: "Sesion expirada o no autenticada." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);

    if (isKanbanRequest) {
      console.warn("[kanban.middleware]", {
        method: request.method,
        pathname,
        action: "redirect_login",
      });
    }

    return NextResponse.redirect(loginUrl);
  }

  if (isKanbanRequest) {
    console.info("[kanban.middleware]", {
      method: request.method,
      pathname,
      action: "authenticated_next",
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
};
