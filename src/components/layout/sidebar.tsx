"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { navigationItems } from "@/components/layout/navigation-config";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col justify-between bg-ink px-6 py-7 text-paper lg:flex xl:w-[296px]">
      <div className="space-y-8">
        <div className="space-y-5">
          <BrandLogo className="max-w-[220px] bg-gradient-to-br from-slate-950 via-black to-cobalt/80 p-3" priority />
          <div className="px-1">
            <div className="font-display text-[2.4rem] tracking-[-0.035em] text-white">Finance</div>
          </div>
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
                  "flex items-center gap-3 rounded-3xl px-4 py-3 text-sm transition",
                  active ? "bg-white text-ink" : "text-paper/72 hover:bg-white/8 hover:text-paper",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-paper/60">Regla central</div>
          <p className="mt-3 text-sm leading-7 text-paper/85">
            Finanzas operativas para Broco Solutions.
          </p>
      </div>
    </aside>
  );
}
