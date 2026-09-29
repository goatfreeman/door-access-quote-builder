import { getSessionUser } from "@/lib/server/auth";
import { readCollection, upsertCatalogItems } from "@/lib/server/nosql-store";
import { importCatalogCsv } from "@/lib/catalog-import";
import { readJsonBodyLimited } from "@/lib/validation/request-body";
import type { CatalogItem } from "@/lib/types";
import { catalogImportFailure, type CatalogImportStage } from "@/lib/catalog-import-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  let stage: CatalogImportStage = "read request";
  try {
    const body = await readJsonBodyLimited(request, 2_500_000) as { csv?: unknown };
    if (typeof body.csv !== "string") return Response.json({ error: "CSV content is required" }, { status: 400 });
    stage = "read catalog";
    const current = await readCollection("items");
    stage = "validate CSV";
    const result = importCatalogCsv(body.csv, Array.isArray(current) ? current as CatalogItem[] : []);
    stage = "write catalog";
    await upsertCatalogItems(result.changedItems);
    stage = "verify catalog";
    const persisted = await readCollection("items") as CatalogItem[];
    return Response.json({ added: result.added, updated: result.updated, total: persisted.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog import failed";
    const failure = catalogImportFailure(error, stage);
    const status = message.includes("Request body exceeds") || message.includes("exceeds the database limit")
      ? 413
      : stage === "read request" || stage === "validate CSV" ? 400 : 500;
    return Response.json(failure, { status });
  }
}