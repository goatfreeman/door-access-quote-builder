import { getStoreStatus } from "@/lib/server/nosql-store";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(getStoreStatus());
}
