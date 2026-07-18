import { isLoginValid, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { AppError } from "@/server/errors";
import { withRoute } from "@/server/http";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  return withRoute(async () => {
    if (!isLoginValid(password)) {
      throw new AppError("Contrasena incorrecta.", 401);
    }
    setSessionCookie();
    return { data: { ok: true } };
  });
}

export async function DELETE() {
  return withRoute(async () => {
    clearSessionCookie();
    return { data: { ok: true } };
  });
}
