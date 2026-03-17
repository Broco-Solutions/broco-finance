"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { BrandLogo } from "@/components/layout/brand-logo";
import { navigationItems } from "@/components/layout/navigation-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  const logout = () => {
    startTransition(async () => {
      await apiFetch("/api/auth", { method: "DELETE" });
      setMobileMenuOpen(false);
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/8 bg-paper/92 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4">
          <div className="min-w-0">
            <div className="hidden lg:block">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Broco Finance</div>
              <p className="mt-1 text-sm text-ink/60">Sesión compartida interna para los dueños de Broco.</p>
            </div>

            <div className="flex items-center gap-3 lg:hidden">
              <BrandLogo className="w-[118px] rounded-[1.2rem] p-2.5 shadow-[0_14px_30px_rgba(16,21,34,0.16)]" priority />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Broco Finance</div>
                <p className="truncate text-sm text-ink/60">Operación financiera móvil</p>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <Button variant="secondary" onClick={logout} disabled={isPending}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>

          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Cerrar navegación" : "Abrir navegación"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5 lg:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
            type="button"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          />
          <div className="absolute inset-x-3 top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[1.8rem] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(244,239,226,0.94))] p-4 shadow-[0_24px_80px_rgba(16,21,34,0.22)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt">Navegación</div>
                <h2 className="mt-2 font-display text-3xl text-ink">Broco Mobile</h2>
                <p className="mt-2 text-sm text-ink/60">Todo el mapa del panel en una sola capa, optimizado para pulgar y scroll corto.</p>
              </div>
              <button
                aria-label="Cerrar menú"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-ink"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    className={cn(
                      "flex items-center justify-between rounded-[1.3rem] border px-4 py-3 text-sm transition",
                      active
                        ? "border-cobalt/20 bg-cobalt/10 text-cobalt"
                        : "border-black/10 bg-white/80 text-ink hover:bg-black/5",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold">{item.label}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.16em] opacity-60">{active ? "Actual" : "Ir"}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5 rounded-[1.4rem] border border-brick/15 bg-brick/5 p-3">
              <Button className="w-full justify-center bg-ink text-paper hover:bg-cobalt" onClick={logout} disabled={isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                {isPending ? "Saliendo…" : "Salir"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
