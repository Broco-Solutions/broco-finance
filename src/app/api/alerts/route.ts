import { withRoute } from "@/server/http";
import { getAlerts } from "@/server/services/finance";

export async function GET() {
  return withRoute(() => getAlerts());
}
