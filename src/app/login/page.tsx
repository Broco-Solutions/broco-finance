import { Suspense } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LoginForm } from "@/components/screens/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6 self-center">
          <div className="chip">Broco Solutions</div>
          <h1 className="font-display text-6xl leading-none text-ink md:text-7xl">
            Finanzas operativas sin volver al Excel.
          </h1>
          <p className="max-w-2xl text-lg leading-9 text-ink/62">
            Dashboard ejecutivo, remanente histórico, capas de distribución, contratos recurrentes y calendario de cobro en una sola aplicación.
          </p>
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <BrandLogo className="mx-auto max-w-[280px]" priority />
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
