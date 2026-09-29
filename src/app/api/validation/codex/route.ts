import { getSessionUser } from "@/lib/server/auth";
import { getValidationStatus, runValidationAgent, ValidationApiError } from "@/lib/validation/hosted";
import { isValidationEnabled } from "@/lib/validation/config";
import { normalizeCompatibilityRequest } from "@/lib/validation/domain";
import { createJobGate } from "@/lib/validation/job-control";
import { orchestrateCompatibility } from "@/lib/validation/orchestrator";
import { readJsonBodyLimited } from "@/lib/validation/request-body";
import { markIncompleteCoverage, resolveCatalogItemVerification } from "@/lib/validation/item-verifier";
import { readCollection } from "@/lib/server/nosql-store";
import { assertPublicEvidenceDestinations } from "@/lib/server/evidence-destination";
import type { CatalogItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
const validationJobGate = createJobGate({ maxConcurrent: 1, cooldownMs: 30_000 });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!isValidationEnabled()) return Response.json({ enabled: false, accountDetail: "Hosted validation is disabled" });
  return Response.json({ enabled: true, ...(await getValidationStatus()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isValidationEnabled()) return Response.json({ error: "Hosted validation is disabled" }, { status: 503 });

  try {
    const body = await readJsonBodyLimited(request, 16_000) as Record<string, unknown>;
    const isCatalogRequest = typeof body.catalogItemId === "string" && Array.isArray(body.quoteItemIds);
    if (!isCatalogRequest && user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const catalogResolution = isCatalogRequest
      ? resolveCatalogItemVerification(
        body.catalogItemId as string,
        (body.quoteItemIds as unknown[]).filter((value): value is string => typeof value === "string"),
        ((await readCollection("items")) as CatalogItem[]),
      )
      : null;
    const compatibilityRequest = catalogResolution?.request ?? normalizeCompatibilityRequest({
        manufacturer: body?.manufacturer,
        sourcePartNumber: body?.sourcePartNumber,
        description: body?.description,
        relatedItems: Array.isArray(body?.relatedItems) ? body.relatedItems : [],
        question: body?.question,
      });
    const reviewed = await validationJobGate.run(user.id, () =>
      orchestrateCompatibility(compatibilityRequest, (role, prompt) =>
        runValidationAgent(role, prompt, fetch, { signal: request.signal })),
    );
    const data = catalogResolution ? markIncompleteCoverage(reviewed, catalogResolution.omittedItems) : reviewed;
    await assertPublicEvidenceDestinations(data);
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compatibility review failed";
    const isBusy = message.includes("worker is busy") || message.includes("wait before");
    const isTooLarge = message.includes("Request body exceeds");
    const isInputError = /^(manufacturer|sourcePartNumber|description|relatedItems|question)\b/.test(message);
    const status = isBusy
      ? 429
      : isTooLarge ? 413 : 400;
    const clientMessage = error instanceof ValidationApiError || isBusy || isTooLarge || isInputError ? message : "Compatibility review failed";
    return Response.json({ error: clientMessage }, { status });
  }
}
