import { getSessionUser } from "@/lib/server/auth";
import { getCodexStatus, runCodexAgent } from "@/lib/validation/codex";
import { isCodexValidationEnabled } from "@/lib/validation/config";
import { normalizeCompatibilityRequest } from "@/lib/validation/domain";
import { createJobGate, createSharedAsyncCache } from "@/lib/validation/job-control";
import { orchestrateCompatibility } from "@/lib/validation/orchestrator";
import { readJsonBodyLimited } from "@/lib/validation/request-body";

export const runtime = "nodejs";
export const maxDuration = 300;
const processGate = createJobGate({ maxConcurrent: 1, cooldownMs: 0 });
const validationJobGate = createJobGate({ maxConcurrent: 1, cooldownMs: 30_000 });
const statusCache = createSharedAsyncCache(() => processGate.run("status", getCodexStatus), 30_000);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!isCodexValidationEnabled()) return Response.json({ enabled: false, accountDetail: "Codex validation is disabled" });
  try {
    return Response.json({ enabled: true, ...(await statusCache.get()) });
  } catch {
    return Response.json(
      { enabled: true, installed: false, authenticated: false, accountDetail: "Codex status is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!isCodexValidationEnabled()) return Response.json({ error: "Codex validation is disabled" }, { status: 503 });

  try {
    const body = await readJsonBodyLimited(request, 16_000) as Record<string, unknown>;
    const compatibilityRequest = normalizeCompatibilityRequest({
      manufacturer: body?.manufacturer,
      sourcePartNumber: body?.sourcePartNumber,
      description: body?.description,
      relatedItems: Array.isArray(body?.relatedItems) ? body.relatedItems : [],
      question: body?.question,
    });
    const data = await validationJobGate.run(user.id, () => processGate.run(user.id, async () => {
      const status = await getCodexStatus();
      if (!status.installed || !status.authenticated) throw new Error("Codex CLI is not ready on this server");
      return orchestrateCompatibility(compatibilityRequest, (role, prompt) => runCodexAgent(role, prompt));
    }));
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compatibility review failed";
    const isBusy = message.includes("worker is busy") || message.includes("wait before");
    const isTooLarge = message.includes("Request body exceeds");
    const isInputError = /^(manufacturer|sourcePartNumber|description|relatedItems|question)\b/.test(message);
    const status = isBusy
      ? 429
      : isTooLarge ? 413 : 400;
    const clientMessage = isBusy || isTooLarge || isInputError ? message : "Compatibility review failed";
    return Response.json({ error: clientMessage }, { status });
  }
}