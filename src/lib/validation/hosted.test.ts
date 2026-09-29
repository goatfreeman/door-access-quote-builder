import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./agent-report.schema.json";
import { getValidationStatus, runValidationAgent, ValidationApiError } from "./hosted";

const environment = { OPENAI_API_KEY: "synthetic-unit-test-value" };
const report = {
  role: "researcher", status: "CONFIRMED", summary: "Manufacturer evidence found.",
  findings: [{ title: "Interface", detail: "Documented interface.", status: "CONFIRMED", affectedItems: ["A-1"], evidence: ["Manufacturer manual: https://www.axis.com/manual"], recommendedAction: "Review the manual." }],
  sources: ["https://www.axis.com/manual"],
};
function envelope(text = JSON.stringify(report), annotations: unknown[] = []) {
  return { status: "completed", output: [
    { type: "web_search_call", status: "completed" },
    { type: "message", role: "assistant", content: [{ type: "output_text", text, annotations }] },
  ] };
}
function mockResponse(value: unknown) {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
}
async function errorCode(fetcher: typeof fetch, code: string) {
  await expect(runValidationAgent("researcher", "Product-only question", fetcher, { environment }))
    .rejects.toMatchObject({ name: "ValidationApiError", code, message: new ValidationApiError(code as ConstructorParameters<typeof ValidationApiError>[0]).message });
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("hosted Responses adapter", () => {
  it("posts the authenticated strict report schema with hosted search and parses a valid result", async () => {
    const fetcher = mockResponse(envelope());
    await expect(runValidationAgent("researcher", "Product-only question", fetcher, { environment })).resolves.toEqual(report);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.method).toBe("POST");
    // Assert presence/scheme only: failures must not print the credential.
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(true);
    expect(headers.get("Authorization")?.startsWith("Bearer ")).toBe(true);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ model: "gpt-5-mini", input: "Product-only question", store: false,
      tools: [{ type: "web_search" }], tool_choice: "required",
      text: { format: { type: "json_schema", strict: true, name: "agent_report", schema } } });
    expect(body.instructions).toContain("researcher");
    expect(JSON.stringify(body).includes(environment.OPENAI_API_KEY)).toBe(false);
    function strictObjects(node: Record<string, unknown>) {
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as object));
        Object.values(node.properties as Record<string, Record<string, unknown>>).forEach(strictObjects);
      }
      if (node.type === "array") strictObjects(node.items as Record<string, unknown>);
    }
    strictObjects(body.text.format.schema);
  });

  it("uses the configured model and retains safe, deduplicated citation URLs", async () => {
    const fetcher = mockResponse(envelope(undefined, [
      { type: "url_citation", url: "https://www.axis.com/datasheet", title: "Datasheet", start_index: 0, end_index: 1 },
      { type: "url_citation", url: report.sources[0] },
      { type: "url_citation", url: "http://127.0.0.1/private" },
      { type: "url_citation", url: "javascript:alert(1)" },
    ]));
    const result = await runValidationAgent("researcher", "Question", fetcher, { environment: { ...environment, OPENAI_VALIDATION_MODEL: "gpt-5-mini-2025-08-07" } });
    expect(result.sources).toEqual([...report.sources, "https://www.axis.com/datasheet"]);
    expect(result.findings).toEqual(report.findings);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string).model).toBe("gpt-5-mini-2025-08-07");
  });

  it.each([401, 403, 429, 400, 404, 500, 503])("sanitizes HTTP %i without reading the error body", async (status) => {
    const response = new Response("private upstream diagnostics", { status });
    const read = vi.spyOn(response, "text");
    await errorCode(vi.fn<typeof fetch>().mockResolvedValue(response), status === 401 || status === 403 ? "authorization" : status === 429 ? "rateLimit" : status >= 500 ? "upstream" : "request");
    expect(read).not.toHaveBeenCalled();
  });

  it("sanitizes network exceptions", async () => {
    await errorCode(vi.fn<typeof fetch>().mockRejectedValue(new Error("private transport diagnostics")), "network");
  });

  it.each([
    ["malformed", envelope("private invalid JSON")],
    ["contract", envelope(JSON.stringify({ ...report, status: "private invalid status" }))],
    ["contract", envelope(JSON.stringify({ ...report, sources: ["http://localhost/private"] }))],
    ["role", envelope(JSON.stringify({ ...report, role: "tester" }))],
    ["missing", { status: "completed", output: [] }],
    ["missing", { status: "completed", output_text: JSON.stringify(report) }],
    ["missing", { ...envelope(), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }],
    ["missing", { ...envelope(), status: "failed", error: { message: "private diagnostics" } }],
    ["refusal", { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "private refusal" }] }] }],
  ])("rejects %s responses with fixed errors", async (code, value) => {
    await errorCode(mockResponse(value), code as string);
  });

  it("rejects malformed envelope JSON and oversized responses", async () => {
    await errorCode(vi.fn<typeof fetch>().mockResolvedValue(new Response("private invalid JSON")), "malformed");
    await errorCode(vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(1_000_001))), "size");
  });

  it("times out and aborts fetch even if the transport never settles", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const result = runValidationAgent("researcher", "Question", fetcher, { environment, timeoutMs: 25 });
    const rejection = expect(result).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ start() {} })));
    const rejection = expect(runValidationAgent("researcher", "Question", fetcher, { environment, timeoutMs: 25 })).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("follows caller cancellation and skips already-aborted requests", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const result = runValidationAgent("researcher", "Question", fetcher, { environment, signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "aborted" });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await expect(runValidationAgent("researcher", "Question", fetcher, { environment, signal: controller.signal })).rejects.toMatchObject({ code: "aborted" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { OPENAI_API_KEY: " " }, { ...environment, OPENAI_VALIDATION_MODEL: "invalid model\nprivate" }])("fails misconfiguration before fetching", async (settings) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(runValidationAgent("researcher", "Question", fetcher, { environment: settings })).rejects.toMatchObject({ code: "configuration" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("hosted status", () => {
  it("retains client status fields without claiming a live credential check", async () => {
    const status = await getValidationStatus(environment);
    expect(status).toEqual({ provider: "openai", configured: true, available: true, installed: true, authenticated: true, version: null,
      accountDetail: "Hosted OpenAI API is configured; access is verified when a review runs." });
    expect(JSON.stringify(status).includes(environment.OPENAI_API_KEY)).toBe(false);
  });
  it("reports missing configuration without exposing raw settings", async () => {
    expect(await getValidationStatus({})).toMatchObject({ configured: false, available: false, installed: true, authenticated: false, version: null });
    const status = await getValidationStatus({ ...environment, OPENAI_VALIDATION_MODEL: "private\ninvalid" });
    expect(status.configured).toBe(false);
    expect(status.accountDetail).toBe(new ValidationApiError("configuration").message);
  });
});
