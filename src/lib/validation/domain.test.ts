import { describe, expect, it } from "vitest";
import {
  normalizeCompatibilityRequest,
  parseAgentReport,
  runDeterministicRules,
} from "./domain";

describe("normalizeCompatibilityRequest", () => {
  it("preserves the source part number and creates a separate lookup key", () => {
    const request = normalizeCompatibilityRequest({
      manufacturer: "  Axis  ",
      sourcePartNumber: "P3265-LVE/22",
      description: "  Outdoor network camera  ",
      relatedItems: ["  T91B47  ", ""],
      question: "  Is this camera compatible with the mount?  ",
    });

    expect(request.sourcePartNumber).toBe("P3265-LVE/22");
    expect(request.normalizedLookupKey).toBe("P3265LVE22");
    expect(request.manufacturer).toBe("Axis");
    expect(request.relatedItems).toEqual(["T91B47"]);
  });

  it("rejects an empty product identifier", () => {
    expect(() =>
      normalizeCompatibilityRequest({
        manufacturer: "Axis",
        sourcePartNumber: "   ",
        description: "Camera",
        relatedItems: [],
        question: "Check compatibility",
      }),
    ).toThrow("sourcePartNumber is required");
  });

  it("rejects an oversized related product identifier", () => {
    expect(() =>
      normalizeCompatibilityRequest({
        manufacturer: "Axis",
        sourcePartNumber: "P3265-LVE/22",
        description: "Camera",
        relatedItems: ["X".repeat(161)],
        question: "Check compatibility",
      }),
    ).toThrow("relatedItems[0] exceeds 160 characters");
  });
});

describe("parseAgentReport", () => {
  it("accepts only web evidence URLs", () => {
    expect(() =>
      parseAgentReport({
        role: "researcher",
        status: "CONFIRMED",
        summary: "Found current manufacturer evidence.",
        findings: [],
        sources: ["javascript:alert(1)"],
      }),
    ).toThrow("http or https");
  });

  it("rejects evidence URLs that target local or private network hosts", () => {
    for (const source of [
      "http://localhost/admin",
      "http://localhost./admin",
      "http://127.0.0.1/status",
      "https://192.168.1.10/manual",
      "http://100.64.0.1/status",
      "https://192.0.2.1/manual",
      "http://224.0.0.1/status",
      "http://[::ffff:127.0.0.1]/status",
      "http://intranet/manual",
      "https://example.internal/manual",
    ]) {
      expect(() => parseAgentReport({
        role: "researcher",
        status: "CONFIRMED",
        summary: "Found evidence.",
        findings: [],
        sources: [source],
      })).toThrow("public web host");
    }

    expect(() => parseAgentReport({
      role: "researcher",
      status: "CONFIRMED",
      summary: "Found evidence.",
      findings: [],
      sources: ["https://fccc.com/manual"],
    })).not.toThrow();
  });
});

describe("runDeterministicRules", () => {
  it("reports quote arithmetic variance with the formula and units", () => {
    const findings = runDeterministicRules([
      {
        sourceRowId: "Equipment!12",
        sourcePartNumber: "P3265-LVE/22",
        quantity: 4,
        unitCost: 100,
        extendedCost: 399.99,
        unitSell: 142.86,
        extendedSell: 571.43,
      },
    ]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId: "RULE-014",
        status: "CONFLICT",
        sourcePartNumber: "P3265-LVE/22",
        formula: "extended cost = quantity × unit cost",
        units: "USD",
      }),
    );
  });

  it("blocks a negative quantity and does not treat it as a valid credit", () => {
    const findings = runDeterministicRules([
      {
        sourceRowId: "Equipment!13",
        sourcePartNumber: "PSU-1",
        quantity: -1,
        unitCost: 10,
        extendedCost: -10,
        unitSell: 15,
        extendedSell: -15,
      },
    ]);

    expect(findings[0]).toEqual(
      expect.objectContaining({ ruleId: "RULE-014", status: "BLOCKED" }),
    );
  });
});