import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompatibilitySettingsPanel, compatibilityAttributeKey, ruleTypePatch } from "./compatibility-settings-panel";

const settings = {
  compatibilityAttributes: [{ id: "fiber-mode", key: "fiber_mode", label: "Fiber mode", allowedValues: ["singlemode", "multimode"] }],
  compatibilityItemAttributes: { "item-1": { fiber_mode: "singlemode" } },
  compatibilityRules: [{
    id: "rule-1",
    name: "Fiber mode must match",
    enabled: true,
    type: "attribute-match" as const,
    source: { category: "Media Converter" },
    target: { category: "Fiber Cable" },
    attributeKey: "fiber_mode",
    status: "CONFLICT" as const,
    message: "{source} requires {sourceValue}; {target} is {targetValue}.",
    revision: 1,
  }],
};

const items = [
  { id: "item-1", sku: "COMNET-SM", name: "ComNet converter", category: "Media Converter", unitPrice: 100 },
];

describe("CompatibilitySettingsPanel", () => {
  it("renders configurable attributes, item values, and deterministic rules", () => {
    const html = renderToStaticMarkup(
      <CompatibilitySettingsPanel settings={settings} items={items} categories={["Media Converter", "Fiber Cable"]} setSettings={vi.fn()} />,
    );

    expect(html).toContain("Deterministic compatibility rules");
    expect(html).toContain("Fiber mode");
    expect(html).toContain("ComNet converter");
    expect(html).toContain("singlemode");
    expect(html).toContain("Fiber mode must match");
    expect(html).toContain("Attribute match");
    expect(html).toContain("Revision 1");
    expect(html).toContain("Source item override");
    expect(html).toContain("Related item override");
    expect(html).toContain("No AI request is used");
  });

  it("normalizes attribute keys for reliable matching", () => {
    expect(compatibilityAttributeKey(" Fiber Mode ")).toBe("fiber_mode");
    expect(compatibilityAttributeKey("Input Voltage (VDC)")).toBe("input_voltage_vdc");
  });

  it("clears hidden selector filters when a rule changes to attribute matching", () => {
    const rule = {
      ...settings.compatibilityRules[0],
      type: "prohibited-combination" as const,
      source: { category: "Media Converter", attributeKey: "fiber_mode", attributeValue: "singlemode" },
      target: { category: "Fiber Cable", attributeKey: "fiber_mode", attributeValue: "multimode" },
    };

    expect(ruleTypePatch(rule, "attribute-match")).toEqual(expect.objectContaining({
      type: "attribute-match",
      source: { category: "Media Converter" },
      target: { category: "Fiber Cable" },
    }));
  });

  it("restores a comparison attribute when a rule changes back to attribute matching", () => {
    const initial = { ...settings.compatibilityRules[0], attributeKey: "input_voltage" };
    const prohibitedPatch = ruleTypePatch(initial, "prohibited-combination");
    const prohibited = { ...initial, ...prohibitedPatch };

    expect(ruleTypePatch(prohibited, "attribute-match", "fiber_mode")).toEqual(expect.objectContaining({
      type: "attribute-match",
      attributeKey: "input_voltage",
    }));
  });

  it("uses messages supported by the selected rule type", () => {
    const initial = settings.compatibilityRules[0];

    expect(ruleTypePatch(initial, "required-companion").message).toBe("Add the required companion for {source}.");
    expect(ruleTypePatch(initial, "prohibited-combination").message).toBe("{source} and {target} are a prohibited combination.");
    expect(ruleTypePatch({ ...initial, type: "required-companion" }, "attribute-match", "fiber_mode").message)
      .toBe("{source} uses {sourceValue}; {target} uses {targetValue}.");
  });
});
