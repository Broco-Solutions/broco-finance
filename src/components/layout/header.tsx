"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { AlertsPayload } from "@/lib/types";
import { AlertBanner } from "@/components/layout/alert-banner";
import { Button } from "@/components/ui/button";

export function Header() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await apiFetch<AlertsPayload>("/api/alerts", { cache: "no-store" });
        if (mounted) {
          setAlerts(data);
        }
      } catch {
        if (mounted) {
          setAlerts(null);
        }
      }
    };

    load();
    const interval = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const logout = () => {
    startTransition(async () => {
      await apiFetch("/api/auth", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-black/8 bg-paper/90 px-5 py-4 backdrop-blur md:px-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Broco Finance</div>
        <p className="mt-1 text-sm text-ink/60">Sesión compartida interna para los dueños de Broco.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AlertBanner alerts={alerts} />
        <Button variant="secondary" onClick={logout} disabled={isPending}>
          <LogOut className="mr-2 h-4 w-4" />
          Salir
        </Button>
      </div>
    </div>
  );
}
