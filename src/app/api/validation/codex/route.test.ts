import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/server/nosql-store", () => ({ readCollection: vi.fn() }));
vi.mock("@/lib/server/evidence-destination", () => ({ assertPublicEvidenceDestinations: vi.fn() }));

import { getSessionUser } from "@/lib/server/auth";
import { assertPublicEvidenceDestinations } from "@/lib/server/evidence-destination";

const input = { manufacturer: "Axis", sourcePartNumber: "A-1", description: "Camera", relatedItems: [], question: "Is it compatible?" };
const request = () => new Request("http://localhost/api/validation/codex", { method: "POST", body: JSON.stringify(input) });
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_VALIDATION_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "synthetic-route-test-value");
  vi.stubEnv("OPENAI_VALIDATION_MODEL", "");
  vi.stubGlobal("fetch", fetcher);
  vi.mocked(getSessionUser).mockResolvedValue({ id: "admin-test", role: "admin" } as Awaited<ReturnType<typeof getSessionUser>>);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("legacy validation endpoint with hosted transport", () => {
  it("returns compatible configuration status without a paid API call", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    expect(await response.json()).toMatchObject({ enabled: true, provider: "openai", configured: true, installed: true, authenticated: true, version: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps disabled and missing-key status explicit", async () => {
    const { GET, POST } = await import("./route");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await (await GET()).json()).toMatchObject({ enabled: true, configured: false, authenticated: false });
    const failure = await POST(request());
    expect(await failure.json()).toEqual({ error: "Hosted validation is not configured. Set OPENAI_API_KEY and a valid OPENAI_VALIDATION_MODEL on the server." });
    vi.stubEnv("OPENAI_VALIDATION_ENABLED", "false");
    expect(await (await GET()).json()).toEqual({ enabled: false, accountDetail: "Hosted validation is disabled" });
    expect((await POST(request())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves authentication and admin-only status/manual review", async () => {
    const { GET, POST } = await import("./route");
    vi.mocked(getSessionUser).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    vi.mocked(getSessionUser).mockResolvedValue({ id: "user-test", role: "user" } as Awaited<ReturnType<typeof getSessionUser>>);
    expect((await GET()).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns the same result envelope after three evidence-backed roles", async () => {
    const roles = ["researcher", "verifier", "tester"];
    for (const role of roles) fetcher.mockResolvedValueOnce(Response.json({ status: "completed", output: [
      { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ role, status: role === "tester" ? "OPEN" : "CONFIRMED", summary: `${role} findings`, findings: [], sources: ["https://www.axis.com/manual"] }) }] },
    ] }));
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.reports.map((report: { role: string }) => report.role)).toEqual(roles);
    expect(data.request.sourcePartNumber).toBe("A-1");
    expect(data.finalStatus).toBe("OPEN");
    expect(data.decisionNotice).toContain("qualified Caltron reviewer");
    expect(fetcher).toHaveBeenCalledTimes(3);
    const prompts = fetcher.mock.calls.map(([, init]) => JSON.parse(init?.body as string).input);
    expect(prompts[1]).toContain("researcher findings");
    expect(prompts[2]).toContain("verifier findings");
    expect(assertPublicEvidenceDestinations).toHaveBeenCalledWith(data);
  });

  it("exposes only the actionable sanitized provider failure", async () => {
    fetcher.mockResolvedValue(new Response("private upstream diagnostics", { status: 401 }));
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "OpenAI rejected validation access. Check the server API key and project/model permissions." });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
