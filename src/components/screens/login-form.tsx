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
    <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-slate-200/70 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08),0_4px_12px_rgba(15,23,42,0.06)] sm:p-8">
      <div className="space-y-3">
        <div className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Acceso interno</div>
        <h1 className="font-display text-[1.7rem] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-3xl">Entrá al tablero operativo</h1>
        <p className="text-sm leading-5 text-slate-500">Ingresá la clave compartida para continuar.</p>
      </div>
      <div className="space-y-2 pt-2">
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contraseña</label>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ingresá la clave compartida"
          className="h-11"
          autoComplete="current-password"
        />
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brick ring-1 ring-red-100">{error}</p> : null}
      <Button type="submit" className="h-11 w-full text-[15px] font-semibold shadow-[0_8px_20px_rgba(37,99,235,0.25)]" disabled={isPending}>
        {isPending ? "Validando…" : "Ingresar"}
      </Button>
      <p className="pt-1 text-center text-xs text-slate-400">Sesión protegida · acceso interno</p>
    </form>
  );
}
