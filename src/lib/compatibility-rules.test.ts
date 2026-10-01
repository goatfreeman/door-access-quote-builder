import { describe, expect, it } from "vitest";
import { evaluateCompatibilityRules } from "./compatibility-rules";

const items = [
  { id: "converter-sm", sku: "COMNET-SM", name: "ComNet singlemode converter", category: "Media Converter", unitPrice: 100 },
  { id: "fiber-mm", sku: "FIBER-MM", name: "Multimode fiber", category: "Fiber Cable", unitPrice: 10 },
  { id: "fiber-sm", sku: "FIBER-SM", name: "Singlemode fiber", category: "Fiber Cable", unitPrice: 12 },
  { id: "power-supply", sku: "PS-24", name: "24 VDC power supply", category: "Power Supply", unitPrice: 30 },
];

const quoteLine = (itemId: string) => ({ lineId: `line-${itemId}`, itemId, name: itemId, sku: itemId, quantity: 1, unitPrice: 1, notes: "" });

const attributesByItem = {
  "converter-sm": { fiber_mode: "singlemode", input_voltage: "24 VDC" },
  "fiber-mm": { fiber_mode: "multimode" },
  "fiber-sm": { fiber_mode: "singlemode" },
  "power-supply": { output_voltage: "24 VDC" },
};

const matchRule = {
  id: "fiber-mode",
  name: "Fiber mode must match",
  enabled: true,
  type: "attribute-match" as const,
  source: { category: "Media Converter" },
  target: { category: "Fiber Cable" },
  attributeKey: "fiber_mode",
  status: "CONFLICT" as const,
  message: "{source} requires {sourceValue}; {target} is {targetValue}.",
  revision: 3,
};

describe("evaluateCompatibilityRules", () => {
  it("returns a configurable warning when matched item attributes conflict", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem,
      rules: [matchRule],
    });

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: "fiber-mode",
        ruleRevision: 3,
        status: "CONFLICT",
        title: "Fiber mode must match",
        message: "ComNet singlemode converter requires singlemode; Multimode fiber is multimode.",
        itemIds: ["converter-sm", "fiber-mm"],
      }),
    ]);
  });

  it("inserts message values literally without expanding replacement syntax or nested placeholders", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items: items.map((item) => item.id === "converter-sm" ? { ...item, name: "$& {target} converter" } : item),
      attributesByItem,
      rules: [matchRule],
    });

    expect(findings[0].message).toBe("$& {target} converter requires singlemode; Multimode fiber is multimode.");
  });

  it("records a confirmed result when compared attributes match", () => {
    const results = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-sm")],
      items,
      attributesByItem,
      rules: [matchRule],
    });

    expect(results).toEqual([expect.objectContaining({ status: "CONFIRMED", ruleRevision: 3 })]);
  });

  it("marks a covered comparison OPEN when a required attribute value is missing", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem: { "converter-sm": { fiber_mode: "singlemode" } },
      rules: [matchRule],
    });

    expect(findings[0]).toEqual(expect.objectContaining({ status: "OPEN" }));
    expect(findings[0].message).toContain("fiber_mode");
  });

  it("treats whitespace-only comparison values as missing", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem: { "converter-sm": { fiber_mode: "   " }, "fiber-mm": { fiber_mode: "\t" } },
      rules: [matchRule],
    });

    expect(findings).toEqual([expect.objectContaining({ status: "OPEN" })]);
  });

  it("treats inherited object properties as missing attributes", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem: { "converter-sm": {}, "fiber-mm": {} },
      rules: [{ ...matchRule, attributeKey: "constructor" }],
    });

    expect(findings).toEqual([expect.objectContaining({ status: "OPEN" })]);
  });

  it("marks an attribute-match rule OPEN when no comparison attribute is configured", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem,
      rules: [{ ...matchRule, attributeKey: undefined }],
    });

    expect(findings).toEqual([expect.objectContaining({ status: "OPEN" })]);
  });

  it("lets a specific item override select the item without a category match", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem,
      rules: [{ ...matchRule, source: { itemId: "converter-sm", category: "Different category" } }],
    });

    expect(findings).toEqual([expect.objectContaining({ status: "CONFLICT" })]);
  });

  it("supports prohibited combinations with generic selectors", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem,
      rules: [{
        id: "prohibited-fiber",
        name: "Do not mix fiber modes",
        enabled: true,
        type: "prohibited-combination",
        source: { category: "Media Converter", attributeKey: "fiber_mode", attributeValue: "singlemode" },
        target: { category: "Fiber Cable", attributeKey: "fiber_mode", attributeValue: "multimode" },
        status: "CONFLICT",
        message: "The selected converter and cable combination is prohibited.",
        revision: 1,
      }],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual(expect.objectContaining({ status: "CONFLICT", ruleId: "prohibited-fiber" }));
  });

  it("marks selector coverage OPEN when a present item is missing a required selector attribute", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm"), quoteLine("fiber-mm")],
      items,
      attributesByItem: { "converter-sm": { fiber_mode: "singlemode" } },
      rules: [{
        id: "prohibited-fiber",
        name: "Do not mix fiber modes",
        enabled: true,
        type: "prohibited-combination",
        source: { category: "Media Converter", attributeKey: "fiber_mode", attributeValue: "singlemode" },
        target: { category: "Fiber Cable", attributeKey: "fiber_mode", attributeValue: "multimode" },
        status: "CONFLICT",
        message: "The combination is prohibited.",
        revision: 1,
      }],
    });

    expect(findings).toEqual([expect.objectContaining({ status: "OPEN" })]);
    expect(findings[0].message).toContain("fiber_mode");
  });

  it("supports required companion rules", () => {
    const rule = {
      id: "power-required",
      name: "Power supply required",
      enabled: true,
      type: "required-companion" as const,
      source: { category: "Media Converter" },
      target: { category: "Power Supply", attributeKey: "output_voltage", attributeValue: "24 VDC" },
      status: "OPEN" as const,
      message: "Add a 24 VDC power supply for {source}.",
      revision: 1,
    };

    expect(evaluateCompatibilityRules({ lines: [quoteLine("converter-sm")], items, attributesByItem, rules: [rule] })[0])
      .toEqual(expect.objectContaining({ ruleId: "power-required", status: "OPEN" }));
    expect(evaluateCompatibilityRules({ lines: [quoteLine("converter-sm"), quoteLine("power-supply")], items, attributesByItem, rules: [rule] }))
      .toEqual([expect.objectContaining({ status: "CONFIRMED" })]);
  });

  it("reports the configured status when the source cannot serve as its own companion", () => {
    const findings = evaluateCompatibilityRules({
      lines: [quoteLine("converter-sm")],
      items,
      attributesByItem: { "converter-sm": {} },
      rules: [{
        id: "second-device-required",
        name: "Second device required",
        enabled: true,
        type: "required-companion",
        source: { category: "Media Converter" },
        target: { category: "Media Converter", attributeKey: "input_voltage", attributeValue: "24 VDC" },
        status: "BLOCKED",
        message: "Add the required companion for {source}.",
        revision: 1,
      }],
    });

    expect(findings).toEqual([expect.objectContaining({ status: "BLOCKED" })]);
  });

  it("keeps opposite required-companion results distinct in either quote order", () => {
    const deviceItems = [
      { id: "device-a", sku: "A", name: "Device A", category: "Device", unitPrice: 1 },
      { id: "device-b", sku: "B", name: "Device B", category: "Device", unitPrice: 1 },
    ];
    const rule = {
      id: "primary-companion",
      name: "Primary companion required",
      enabled: true,
      type: "required-companion" as const,
      source: { category: "Device" },
      target: { category: "Device", attributeKey: "role", attributeValue: "primary" },
      status: "OPEN" as const,
      message: "Add a primary companion for {source}.",
      revision: 1,
    };
    const evaluate = (order: string[]) => evaluateCompatibilityRules({
      lines: order.map(quoteLine),
      items: deviceItems,
      attributesByItem: { "device-a": { role: "primary" }, "device-b": {} },
      rules: [rule],
    });

    expect(evaluate(["device-a", "device-b"]).map((result) => result.status).sort()).toEqual(["CONFIRMED", "OPEN"]);
    expect(evaluate(["device-b", "device-a"]).map((result) => result.status).sort()).toEqual(["CONFIRMED", "OPEN"]);
  });
});
