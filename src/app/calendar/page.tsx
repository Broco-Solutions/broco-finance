import { CalendarScreen } from "@/components/screens/calendar-screen";
import { listScheduledPayments } from "@/server/services/finance";

export default async function CalendarPage() {
  const { data, demoMode } = await listScheduledPayments();
  return <CalendarScreen payments={data} demoMode={demoMode} />;
}
