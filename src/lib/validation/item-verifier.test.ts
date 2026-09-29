import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../types";
import { buildItemVerificationRequest, markIncompleteCoverage, resolveCatalogItemVerification } from "./item-verifier";

const selected: CatalogItem = {
  id: "item-comnet",
  name: "ComNet multimode media converter",
  sku: "CNFE2MC/2",
  category: "Fiber",
  unitPrice: 100,
  vendor: "ComNet",
  notes: "https://example.internal/client-name",
};

describe("buildItemVerificationRequest", () => {
  it("asks for required companion parts and fiber compatibility using product identifiers only", () => {
    const request = buildItemVerificationRequest(selected, [
      { ...selected, id: "patch", name: "Multimode patch cable", sku: "MM-LC-LC-3M" },
    ]);

    expect(request.manufacturer).toBe("ComNet");
    expect(request.sourcePartNumber).toBe("CNFE2MC/2");
    expect(request.relatedItems).toEqual(["MM-LC-LC-3M"]);
    expect(request.question).toContain("required companion parts");
    expect(request.question).toContain("each related quote item");
    expect(request.question).toContain("fiber mode");
    expect(request.question).toContain("singlemode or multimode");
    expect(request.question).toContain("connector type");
    expect(request.question).toContain("wavelength");
    expect(request.question).toContain("data rate");
    expect(request.question).toContain("fiber patch cable");
    expect(request.question).toContain("transceiver");
    expect(JSON.stringify(request)).not.toContain("example.internal");
  });

  it("limits the quote context to 25 unique product identifiers", () => {
    const related = Array.from({ length: 30 }, (_, index) => ({
      ...selected,
      id: `item-${index}`,
      sku: `SKU-${index % 26}`,
    }));
    expect(buildItemVerificationRequest(selected, related).relatedItems).toHaveLength(25);
  });

  it("marks an unknown manufacturer as OPEN instead of guessing from the item name", () => {
    const request = buildItemVerificationRequest({ ...selected, vendor: undefined }, []);
    expect(request.manufacturer).toBe("OPEN");
  });
});

describe("resolveCatalogItemVerification", () => {
  it("resolves only server catalog records from item ids", () => {
    const patchCable = { ...selected, id: "patch", sku: "MM-LC-LC-3M" };
    const resolution = resolveCatalogItemVerification("item-comnet", ["patch", "missing"], [selected, patchCable]);
    expect(resolution.request.sourcePartNumber).toBe("CNFE2MC/2");
    expect(resolution.request.relatedItems).toEqual(["MM-LC-LC-3M"]);
    expect(resolution.omittedItems).toEqual(["Unresolved quote item 1"]);
  });

  it("rejects an unknown selected catalog item", () => {
    expect(() => resolveCatalogItemVerification("missing", [], [selected])).toThrow("Catalog item was not found");
  });

  it("reports identifiers omitted from the 25-item review limit", () => {
    const related = Array.from({ length: 27 }, (_, index) => ({
      ...selected,
      id: `item-${index}`,
      sku: `SKU-${index}`,
    }));
    const resolution = resolveCatalogItemVerification("item-comnet", related.map((item) => item.id), [selected, ...related]);
    expect(resolution.request.relatedItems).toHaveLength(25);
    expect(resolution.omittedItems).toEqual(["SKU-25", "SKU-26"]);
  });

  it("marks deleted and unknown quote items as unresolved coverage", () => {
    const deleted = { ...selected, id: "deleted", sku: "OLD-1", deletedAt: "2026-01-01T00:00:00.000Z" };
    const resolution = resolveCatalogItemVerification("item-comnet", ["deleted", "custom"], [selected, deleted]);
    expect(resolution.omittedItems).toEqual(["OLD-1 (deleted catalog item)", "Unresolved quote item 1"]);
  });

  it("marks catalog items with blank SKUs as unresolved coverage", () => {
    const blankSku = { ...selected, id: "blank", sku: "   " };
    const resolution = resolveCatalogItemVerification("item-comnet", ["blank"], [selected, blankSku]);
    expect(resolution.omittedItems).toEqual(["Catalog item with blank SKU 1"]);
  });

  it("uses a controlled related item as the package anchor when the selected item has a blank SKU", () => {
    const blankSelected = { ...selected, sku: "   " };
    const validRelated = { ...selected, id: "valid", sku: "VALID-1" };
    const resolution = resolveCatalogItemVerification("item-comnet", ["valid"], [blankSelected, validRelated]);
    expect(resolution.request.sourcePartNumber).toBe("VALID-1");
    expect(resolution.omittedItems).toEqual(["Selected catalog item with blank SKU"]);
  });

  it("forces incomplete compatibility coverage to OPEN and identifies omitted items", () => {
    const result = markIncompleteCoverage({
      request: buildItemVerificationRequest(selected, []),
      finalStatus: "CONFIRMED",
      decisionNotice: "Review required.",
      reports: [{ role: "tester", status: "CONFIRMED", summary: "Checked.", findings: [], sources: [] }],
    }, ["PATCH-26"]);

    expect(result.finalStatus).toBe("OPEN");
    expect(result.reports[0].status).toBe("OPEN");
    expect(result.reports[0].findings[0].affectedItems).toEqual(["PATCH-26"]);
  });
});