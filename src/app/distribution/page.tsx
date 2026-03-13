import { DistributionScreen } from "@/components/screens/distribution-screen";
import { getDistributionPage } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function DistributionPage() {
  const data = await getDistributionPage(new Date().toISOString().slice(0, 8) + "01");
  return <DistributionScreen data={data} demoMode={!process.env.DATABASE_URL} />;
}
