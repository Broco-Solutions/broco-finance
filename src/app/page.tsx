import { getDashboard } from "@/server/services/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage({ searchParams }: { searchParams?: { month?: string; year?: string } }) {
  const month = searchParams?.month ? parseInt(searchParams.month) : undefined;
  const year = searchParams?.year ? parseInt(searchParams.year) : undefined;
  const data = await getDashboard(month, year);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dashboard" title="Dashboard" description={`${String(data.period.month).padStart(2,"0")}/${data.period.year}`} meta={null} />
      <DashboardContent data={data} />
    </div>
  );
}
