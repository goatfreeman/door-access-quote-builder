import { getSessionUser } from "@/lib/server/auth";
import { readCollection, upsertCatalogItems } from "@/lib/server/nosql-store";
import { importCatalogCsv } from "@/lib/catalog-import";
import { readJsonBodyLimited } from "@/lib/validation/request-body";
import type { CatalogItem } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await readJsonBodyLimited(request, 2_500_000) as { csv?: unknown };
    if (typeof body.csv !== "string") return Response.json({ error: "CSV content is required" }, { status: 400 });
    const current = await readCollection("items");
    const result = importCatalogCsv(body.csv, Array.isArray(current) ? current as CatalogItem[] : []);
    await upsertCatalogItems(result.changedItems);
    const persisted = await readCollection("items") as CatalogItem[];
    return Response.json({ added: result.added, updated: result.updated, total: persisted.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog import failed";
    const safeMessage = /^(Missing CSV|Unexpected CSV|CSV |Duplicate SKU|Duplicate CSV|\w+ (is required|must be|exceeds))/.test(message)
      ? message
      : "Catalog import failed";
    return Response.json({ error: safeMessage }, { status: message.includes("exceeds") ? 413 : 400 });
  }
}