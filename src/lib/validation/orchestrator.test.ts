import { describe, expect, it } from "vitest";
import type { AgentReport, AgentRole, CompatibilityRequest } from "./domain";
import { orchestrateCompatibility } from "./orchestrator";

const request: CompatibilityRequest = {
  manufacturer: "Axis",
  sourcePartNumber: "P3265-LVE/22",
  normalizedLookupKey: "P3265LVE22",
  description: "Outdoor network camera",
  relatedItems: ["T91B47"],
  question: "Is this combination compatible?",
};

function report(role: AgentRole): AgentReport {
  return {
    role,
    status: role === "tester" ? "ASSUMED" : "CONFIRMED",
    summary: `${role} report`,
    findings: [],
    sources: ["https://www.axis.com/example"],
  };
}

describe("orchestrateCompatibility", () => {
  it("runs independent researcher, verifier, and tester stages in order", async () => {
    const calls: Array<{ role: AgentRole; prompt: string }> = [];
    const result = await orchestrateCompatibility(request, async (role, prompt) => {
      calls.push({ role, prompt });
      return report(role);
    });

    expect(calls.map((call) => call.role)).toEqual(["researcher", "verifier", "tester"]);
    expect(calls[1].prompt).toContain("researcher report");
    expect(calls[2].prompt).toContain("researcher report");
    expect(calls[2].prompt).toContain("verifier report");
    expect(calls.every((call) => call.prompt.includes("untrusted evidence"))).toBe(true);
    expect(result.finalStatus).toBe("ASSUMED");
    expect(result.decisionNotice).toContain("qualified Caltron reviewer");
  });

  it("rejects a report returned for the wrong agent role", async () => {
    await expect(
      orchestrateCompatibility(request, async () => report("tester")),
    ).rejects.toThrow("role mismatch");
  });

  it("does not conceal a blocking report or finding behind a confirmed tester status", async () => {
    const result = await orchestrateCompatibility(request, async (role) => ({
      ...report(role),
      status: role === "researcher" ? "BLOCKED" : "CONFIRMED",
      findings: role === "tester" ? [{
        status: "BLOCKED",
        title: "Physical test required",
        detail: "The interface is not verified.",
        affectedItems: ["P3265-LVE/22"],
        evidence: [],
        recommendedAction: "Test before approval.",
      }] : [],
    }));

    expect(result.finalStatus).toBe("BLOCKED");
  });
});