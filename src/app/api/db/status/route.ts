import { getStoreStatus } from "@/lib/server/nosql-store";

export async function GET() {
  return Response.json(getStoreStatus());
}
