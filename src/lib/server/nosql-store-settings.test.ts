import { describe, expect, it } from "vitest";
import { sanitizeSettings } from "./nosql-store";

describe("sanitizeSettings compatibility configuration", () => {
  it("preserves valid deterministic compatibility attributes, assignments, and rules", () => {
    expect(sanitizeSettings({
      categories: ["Media Converter", "Fiber Cable"],
      compatibilityAttributes: [{ id: "fiber", key: "fiber_mode", label: "Fiber mode", allowedValues: ["singlemode", "multimode"] }],
      compatibilityItemAttributes: { "item-1": { fiber_mode: "singlemode" } },
      compatibilityRules: [{
        id: "rule-1",
        name: "Fiber mode must match",
        enabled: true,
        type: "attribute-match",
        source: { category: "Media Converter" },
        target: { category: "Fiber Cable" },
        attributeKey: "fiber_mode",
        status: "CONFLICT",
        message: "Mismatch",
        revision: 4,
      }],
    })).toEqual(expect.objectContaining({
      categories: ["Media Converter", "Fiber Cable"],
      compatibilityAttributes: [{ id: "fiber", key: "fiber_mode", label: "Fiber mode", allowedValues: ["singlemode", "multimode"] }],
      compatibilityItemAttributes: { "item-1": { fiber_mode: "singlemode" } },
      compatibilityRules: [expect.objectContaining({ id: "rule-1", type: "attribute-match", status: "CONFLICT", revision: 4 })],
    }));
  });

  it("rejects unsupported rule types and statuses", () => {
    const settings = sanitizeSettings({
      compatibilityRules: [
        { id: "bad-type", name: "Bad", enabled: true, type: "execute-code", source: {}, target: {}, status: "CONFLICT", message: "Bad" },
        { id: "bad-status", name: "Bad", enabled: true, type: "attribute-match", source: {}, target: {}, status: "APPROVED", message: "Bad" },
      ],
    });

    expect(settings.compatibilityRules).toEqual([]);
  });
});
