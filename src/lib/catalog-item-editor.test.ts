import { describe, expect, it } from "vitest";
import { applyCatalogItemEdit, changedCatalogItemEditPatch, hasCatalogItemEditChanges } from "./catalog-item-editor";
import type { CatalogItem } from "./types";

const item: CatalogItem = {
  id: "item-1",
  name: "Reader",
  sku: "RDR-1",
  category: "Access Control",
  unit: "EA",
  unitPrice: 125,
  adi: "ADI-1",
  msrp: 175,
  vendor: "Preferred",
  inventory: 4,
  link: "https://example.com/reader",
  notes: "Original notes",
};

describe("catalog item edit drafts", () => {
  it("detects edits without changing the saved item", () => {
    const draft = applyCatalogItemEdit(item, { category: "Readers", unitPrice: 150 });

    expect(draft).not.toBe(item);
    expect(draft.category).toBe("Readers");
    expect(draft.unitPrice).toBe(150);
    expect(item.category).toBe("Access Control");
    expect(item.unitPrice).toBe(125);
    expect(hasCatalogItemEditChanges(item, draft)).toBe(true);
  });

  it("does not overwrite fields that are outside the item editor", () => {
    const current = { ...item, vendor: "Current vendor", inventory: 8 };
    const staleDraft = { ...item, vendor: "Old vendor", inventory: 12 };

    expect(applyCatalogItemEdit(current, staleDraft)).toMatchObject({
      vendor: "Current vendor",
      inventory: 12,
    });
  });

  it("commits only fields changed from the edit baseline", () => {
    const draft = applyCatalogItemEdit(item, { notes: "Updated notes" });
    const current = { ...item, inventory: 12 };

    expect(applyCatalogItemEdit(current, changedCatalogItemEditPatch(item, draft))).toMatchObject({
      inventory: 12,
      notes: "Updated notes",
    });
    expect(changedCatalogItemEditPatch(item, draft)).toEqual({ notes: "Updated notes" });
  });

  it("only treats fields in the item editor as pending edits", () => {
    expect(hasCatalogItemEditChanges(item, { ...item })).toBe(false);
    expect(hasCatalogItemEditChanges(item, { ...item, deletedAt: "2026-09-29T00:00:00.000Z" })).toBe(false);
    expect(hasCatalogItemEditChanges(item, { ...item, notes: "Changed" })).toBe(true);
  });

  it("treats missing optional editor text and empty text as equivalent", () => {
    const withoutOptionalText = { ...item, link: undefined, notes: undefined };
    const withEmptyText = { ...withoutOptionalText, link: "", notes: "" };

    expect(hasCatalogItemEditChanges(withoutOptionalText, withEmptyText)).toBe(false);
  });
});
