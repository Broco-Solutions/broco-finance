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
    <main className="flex min-h-screen items-center justify-center bg-[#f1f5f9] px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-ink to-cobalt/90 px-6 py-7 flex justify-center">
          <Image
            src="/Logo%20BS%20-%20Negativo.svg"
            alt="Broco Solutions"
            width={200}
            height={78}
            priority
            className="h-auto w-[200px]"
          />
        </div>
        <div className="p-8">
          <h1 className="font-display text-xl text-ink">Seguimiento de proyecto</h1>
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
      </div>
    </main>
  );
}
