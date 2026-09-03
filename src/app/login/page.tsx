import { Suspense } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LoginForm } from "@/components/screens/login-form";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50" />
        <div className="absolute inset-0 bg-gradient-to-tr from-cobalt/[0.07] via-transparent to-blue-200/30" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute -right-24 -top-24 h-[560px] w-[560px] rounded-full bg-blue-200/40 blur-[90px]" />
        <div className="absolute -left-32 top-[38%] h-[480px] w-[480px] rounded-full bg-cobalt/12 blur-[90px]" />
        <div className="absolute left-1/2 top-[52%] h-[1px] w-[72%] -translate-x-1/2 rotate-[-8deg] bg-gradient-to-r from-transparent via-cobalt/12 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cobalt/20 to-transparent" />
        <div className="absolute bottom-0 right-0 hidden select-none text-[22rem] font-black leading-none tracking-tighter text-slate-900/[0.04] lg:block" aria-hidden>
          BS
        </div>
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1200px] grid-cols-1 items-center gap-8 px-5 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.05fr,0.95fr] lg:gap-10 lg:px-8 lg:py-12">
        {/* Left: institutional */}
        <div className="order-2 space-y-7 lg:order-1 lg:space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium tracking-wide text-slate-600 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-cobalt" /> Broco Solutions · Tecnología aplicada
            </div>
            <h1 className="max-w-[14ch] font-display text-[2.5rem] font-[650] leading-[0.95] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.5rem]">
              La operación del negocio, en un solo lugar.
            </h1>
            <p className="max-w-[48ch] text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8">
              Gestioná clientes, proyectos, ingresos, gastos e indicadores desde una plataforma clara, centralizada y preparada para acompañar la operación.
            </p>
          </div>

          <div className="grid gap-3 pt-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              { t: "Clientes y proyectos", d: "Seguimiento ordenado." },
              { t: "Ingresos y gastos", d: "Control sin fricción." },
              { t: "Indicadores claros", d: "Decisiones a tiempo." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-slate-200/70 bg-white/60 p-3.5 backdrop-blur">
                <div className="text-sm font-semibold leading-none text-ink">{f.t}</div>
                <div className="mt-1 text-xs leading-4 text-slate-500">{f.d}</div>
              </div>
            ))}
          </div>

          <div className="hidden items-center gap-3 pt-2 text-xs text-slate-400 lg:flex">
            <span className="h-px w-8 bg-slate-200" /> Plataforma interna de Broco Solutions
          </div>
        </div>

        {/* Right: access */}
        <div className="order-1 flex w-full justify-center lg:order-2 lg:justify-end">
          <div className="w-full max-w-[420px]">
            <div className="flex justify-center">
              <BrandLogo className="mx-auto max-w-[200px] sm:max-w-[220px] lg:max-w-[200px]" priority />
            </div>
            <div className="mt-5">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
            <p className="mt-6 text-center text-xs leading-4 text-slate-400">Acceso exclusivo para el equipo de Broco Solutions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
