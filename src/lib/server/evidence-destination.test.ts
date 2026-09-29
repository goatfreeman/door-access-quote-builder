import { describe, expect, it } from "vitest";
import type { CompatibilityResult } from "../validation/domain";
import { assertPublicEvidenceDestinations } from "./evidence-destination";

const result = (source: string): CompatibilityResult => ({
  request: {
    manufacturer: "ComNet",
    sourcePartNumber: "CNFE2MC/2",
    normalizedLookupKey: "CNFE2MC2",
    description: "Converter",
    relatedItems: [],
    question: "Check compatibility",
  },
  finalStatus: "OPEN",
  decisionNotice: "Qualified review required.",
  reports: [{ role: "tester", status: "OPEN", summary: "Check", findings: [], sources: [source] }],
});

describe("assertPublicEvidenceDestinations", () => {
  it("accepts a hostname only when every resolved address is public", async () => {
    await expect(assertPublicEvidenceDestinations(result("https://manufacturer.example.com/manual"), async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ])).resolves.toBeUndefined();
  });

  it("rejects private, loopback, reserved, and unresolved destinations", async () => {
    for (const addresses of [
      [{ address: "10.0.0.1", family: 4 }],
      [{ address: "127.0.0.1", family: 4 }],
      [{ address: "192.0.2.1", family: 4 }],
      [{ address: "::1", family: 6 }],
      [{ address: "fc00::1", family: 6 }],
      [{ address: "fec0::1", family: 6 }],
      [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }],
      [],
    ]) {
      await expect(assertPublicEvidenceDestinations(result("https://manufacturer.example.com/manual"), async () => addresses))
        .rejects.toThrow("public network destination");
    }
  });
});
