"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function Header() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const logout = () => {
    startTransition(async () => {
      await apiFetch("/api/auth", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-black/8 bg-paper/90 px-5 py-4 backdrop-blur md:px-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Broco Finance</div>
        <p className="mt-1 text-sm text-ink/60">Sesión compartida interna para los dueños de Broco.</p>
      </div>
      <Button variant="secondary" onClick={logout} disabled={isPending}>
        <LogOut className="mr-2 h-4 w-4" />
        Salir
      </Button>
    </div>
  );
}
