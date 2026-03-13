import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "broco_session";
const DEMO_PASSWORD = "demo";

export function isLoginValid(password: string) {
  const configuredPassword = process.env.APP_PASSWORD;

  if (!configuredPassword) {
    return password === DEMO_PASSWORD;
  }

  return password === configuredPassword;
}

export function getAuthCookieName() {
  return AUTH_COOKIE;
}

export function setSessionCookie() {
  cookies().set(AUTH_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(AUTH_COOKIE);
}

export function isAuthenticated() {
  return cookies().get(AUTH_COOKIE)?.value === "ok";
}

export function requireAuth() {
  if (!isAuthenticated()) {
    redirect("/login");
  }
}
