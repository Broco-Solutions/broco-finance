import { getDashboard } from "@/server/services/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage({ searchParams }: { searchParams?: { month?: string; year?: string; from?: string; to?: string } }) {
  const rawM = searchParams?.month ? parseInt(searchParams.month) : NaN;
  const rawY = searchParams?.year ? parseInt(searchParams.year) : NaN;
  const from = searchParams?.from || undefined;
  const to = searchParams?.to || undefined;

  const month = Number.isFinite(rawM) && rawM >= 1 && rawM <= 12 ? rawM : undefined;
  const year = Number.isFinite(rawY) && rawY >= 2000 && rawY <= 2100 ? rawY : undefined;

  const monthA = month ?? new Date().getMonth() + 1;
  const yearA = year ?? new Date().getFullYear();
  const data = await getDashboard(monthA, yearA);

  let prevData;
  if (!from && !to) {
    const prevM = monthA === 1 ? 12 : monthA - 1;
    const prevY = monthA === 1 ? yearA - 1 : yearA;
    prevData = await getDashboard(prevM, prevY);
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Dashboard" title="Dashboard financiero" description="" meta={null} />
      <DashboardClient data={data} prevData={prevData ?? undefined} />
    </div>
  );
}
