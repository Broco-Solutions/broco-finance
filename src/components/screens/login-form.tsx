"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        await apiFetch("/api/auth", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        router.push(searchParams.get("redirectTo") ?? "/");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo iniciar sesión.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="panel max-w-md space-y-6 p-8">
      <div className="space-y-2">
        <div className="chip">Acceso interno</div>
        <h1 className="font-display text-4xl text-ink">Entrá al tablero operativo</h1>
        <p className="text-sm leading-7 text-ink/60">
          Si todavía no configuraste `APP_PASSWORD`, usá la clave <span className="font-semibold">demo</span>.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">Contraseña</label>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ingresá la clave compartida"
        />
      </div>
      {error ? <p className="text-sm text-brick">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Validando…" : "Ingresar"}
      </Button>
    </form>
  );
}
