"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalLoginAction } from "./actions";

export function PortalPasswordGate({
  slug,
  projectName,
  clientName,
}: {
  slug: string;
  projectName: string;
  clientName: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("password", password);
    const result = await portalLoginAction(null, fd);
    setPending(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50" />
        <div className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-blue-100/50 blur-[90px]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[380px] w-[380px] rounded-full bg-cobalt/10 blur-[80px]" />
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-[1.6rem] border border-slate-200/60 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.10),0_6px_16px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-br from-slate-950 via-ink to-cobalt/90 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 p-2 ring-1 ring-white/15 backdrop-blur">
            <Image
              src="/Icono%20BS%20-%20Negativo.png"
              alt="Broco Solutions"
              width={40}
              height={40}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Broco Solutions</p>
            <h1 className="mt-0.5 font-display text-lg font-semibold leading-none text-white">Seguimiento de proyecto</h1>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-ink">{projectName}</h2>
          <p className="mt-1 text-sm text-slate-500">{clientName}</p>
          <div className="mt-5 space-y-1.5 rounded-xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-100">
            <p className="text-sm font-medium text-ink">Este proyecto es privado.</p>
            <p className="text-sm leading-5 text-slate-500">Ingresá la contraseña para continuar.</p>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="portal-password" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contraseña</label>
              <Input
                id="portal-password"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-brick ring-1 ring-red-100">{error}</p>}
            <Button type="submit" disabled={pending} className="h-11 w-full text-[15px] font-semibold shadow-[0_8px_20px_rgba(37,99,235,0.25)]">
              {pending ? "Verificando…" : "Acceder"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
