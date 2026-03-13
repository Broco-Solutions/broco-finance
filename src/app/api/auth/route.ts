import { z } from "zod";
import { clearSessionCookie, isLoginValid, setSessionCookie } from "@/lib/auth";
import { AppError } from "@/server/errors";
import { readJson, withRoute } from "@/server/http";

const schema = z.object({
  password: z.string().min(1, "Ingresá la contraseña."),
});

export async function POST(request: Request) {
  return withRoute(async () => {
    const { password } = await readJson(request, schema);

    if (!isLoginValid(password)) {
      throw new AppError("La contraseña no coincide.", 401);
    }

    setSessionCookie();
    return { ok: true };
  });
}

export async function DELETE() {
  clearSessionCookie();
  return Response.json({ data: { ok: true } });
}
