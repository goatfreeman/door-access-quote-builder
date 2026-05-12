import { getSessionUser } from "@/lib/server/auth";
import { getIntegrationPluginStatuses } from "@/lib/plugins";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ data: getIntegrationPluginStatuses() });
}
