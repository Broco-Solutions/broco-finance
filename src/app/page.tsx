import { getDashboard } from "@/server/services/dashboard";
import { resolvePeriod } from "@/lib/periods";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage({ searchParams }: { searchParams?: { period?: string; from?: string; to?: string } }) {
  const p = resolvePeriod(searchParams?.period ?? null, searchParams?.from ?? null, searchParams?.to ?? null);
  const [data, prevData] = await Promise.all([getDashboard(p.from, p.to), getDashboard(p.prevFrom, p.prevTo)]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Dashboard" title="Dashboard financiero" description="" meta={null} />
      <DashboardClient data={data} prevData={prevData} periodLabel={p.label} period={searchParams?.period ?? "this-month"}
        rangeFrom={p.from} rangeTo={p.to} prevFrom={p.prevFrom} prevTo={p.prevTo} />
    </div>
  );
}
