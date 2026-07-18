import { getDashboard } from "@/server/services/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage({ searchParams }: { searchParams?: { month?: string; year?: string } }) {
  const rawMonth = searchParams?.month ? parseInt(searchParams.month) : NaN;
  const rawYear = searchParams?.year ? parseInt(searchParams.year) : NaN;
  const month = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : undefined;
  const year = Number.isFinite(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : undefined;
  const data = await getDashboard(month, year);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dashboard" title="Dashboard" description={`${String(data.period.month).padStart(2,"0")}/${data.period.year}`} meta={null} />
      <DashboardContent data={data} />
    </div>
  );
}
