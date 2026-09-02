import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  resolveShareGateBySlug,
  authorizeClientAccess,
  getAuthorizedProjectPlan,
} from "@/server/services/project-sharing";
import {
  computeProjectProgress,
  computeElapsedPercent,
  resolveGoLive,
} from "@/lib/project-progress";
import { ProjectGantt } from "@/components/projects/dhtmlx/project-gantt";
import { TaskStatusLegend } from "@/components/projects/task-status-legend";
import { PortalPasswordGate } from "./portal-password-gate";
import { PortalLogoutButton } from "./portal-logout-button";

export const dynamic = "force-dynamic";

function fmtLong(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const day = date.getUTCDate();
  const month = date.toLocaleString("es-AR", { month: "long", timeZone: "UTC" });
  return `${day} de ${month} de ${date.getUTCFullYear()}`;
}

function goLiveText(g: { hasDate: boolean; daysRemaining: number | null; isToday: boolean }): string | null {
  if (!g.hasDate) return null;
  if (g.isToday) return "Hoy";
  if (g.daysRemaining != null && g.daysRemaining < 0) return `Hace ${-g.daysRemaining} días`;
  return `${g.daysRemaining} días`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const gate = await resolveShareGateBySlug(params.slug);
  return {
    title: gate ? `${gate.projectName} | Broco Solutions` : "Broco Solutions",
    robots: { index: false, follow: false },
  };
}

export default async function PortalPage({ params }: { params: { slug: string } }) {
  const gate = await resolveShareGateBySlug(params.slug);

  if (!gate) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f8fafc] to-white px-4">
        <p className="text-center text-ink/60">Este enlace no está disponible.</p>
      </main>
    );
  }

  const session = cookies().get("portal_session")?.value ?? null;
  const auth = await authorizeClientAccess(params.slug, session);

  if (!auth) {
    return (
      <PortalPasswordGate slug={params.slug} projectName={gate.projectName} clientName={gate.clientName} />
    );
  }

  const plan = await getAuthorizedProjectPlan(params.slug, session);

  if (!plan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f8fafc] to-white px-4">
        <p className="text-center text-ink/60">Este enlace no está disponible.</p>
      </main>
    );
  }

  const progress = computeProjectProgress(plan.tasks);
  const elapsed = computeElapsedPercent(plan.startDate, plan.endDate);
  const goLive = resolveGoLive(plan.goLiveDate);
  const goLiveValue = goLiveText(goLive);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt">Broco Solutions</p>
            <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">Seguimiento de proyecto</h1>
            <p className="mt-1 text-ink/50">Sistema de Gestión · {plan.client.name}</p>
          </div>
          <PortalLogoutButton slug={params.slug} />
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-ink">{plan.name}</h2>
          <p className="mt-1 text-sm text-ink/50">Cliente: {plan.client.name}</p>
          <p className="mt-2 text-sm text-ink/70">
            {fmtLong(plan.startDate)} — {fmtLong(plan.endDate)}
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Avance completado" value={progress.hasTasks ? `${progress.percent}%` : "Sin tareas"} />
          <MetricCard label="Tiempo transcurrido" value={elapsed === null ? "—" : `${elapsed}%`} />
          {goLiveValue && <MetricCard label="Go Live" value={goLiveValue} />}
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-ink">Cronograma</h2>
            <TaskStatusLegend />
          </div>
          {plan.tasks.length === 0 ? (
            <p className="mt-6 text-sm text-ink/50">El cronograma de este proyecto todavía no está disponible.</p>
          ) : (
            <div className="mt-4">
              <ProjectGantt
                phases={JSON.parse(JSON.stringify(plan.phases))}
                tasks={JSON.parse(JSON.stringify(plan.tasks))}
                goLiveDate={plan.goLiveDate ? plan.goLiveDate.toISOString() : null}
                projectId={plan.id}
                portal
              />
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-ink/40">Actualizado: {fmtLong(plan.updatedAt)}</p>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="font-display text-3xl text-ink">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-ink/50">{label}</div>
    </div>
  );
}
