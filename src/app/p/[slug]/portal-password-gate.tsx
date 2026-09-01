"use client";

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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f8fafc] to-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt">Broco Solutions</p>
        <h1 className="mt-2 font-display text-2xl text-ink">Seguimiento de proyecto</h1>
        <p className="mt-1 text-sm font-medium text-ink">{projectName}</p>
        <p className="text-sm text-ink/60">{clientName}</p>
        <p className="mt-6 text-sm text-ink/70">Este proyecto es privado.</p>
        <p className="text-sm text-ink/70">Ingresá la contraseña para continuar.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-brick">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Verificando..." : "Acceder"}
          </Button>
        </form>
      </div>
    </main>
  );
}
