import { describe, expect, it } from "vitest";
import { exportCatalogCsv } from "./catalog-csv";
import { importCatalogCsv } from "./catalog-import";
import type { CatalogItem } from "./types";

describe("exportCatalogCsv", () => {
  it("exports active catalog items in the import format and preserves quoted text", () => {
    const items: CatalogItem[] = [
      {
        id: "item-active",
        name: "Converter, multimode",
        sku: "MM-1",
        category: "Fiber",
        unit: "EA",
        unitPrice: 10.5,
        adi: "ADI-1",
        msrp: 20,
        inventory: 2,
        link: "https://example.com/item",
        notes: 'Use "preferred" stock',
      },
      {
        id: "item-deleted",
        name: "Deleted item",
        sku: "OLD-1",
        category: "Old",
        unitPrice: 1,
        deletedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const csv = exportCatalogCsv(items);
    expect(csv).toContain("name,sku,category,unit,price,adi,msrp,inventory,link,notes");
    expect(csv).not.toContain("Deleted item");

    const imported = importCatalogCsv(csv, [], () => "item-imported");
    expect(imported.items).toEqual([{ ...items[0], id: "item-imported" }]);
  });

  it("neutralizes spreadsheet formulas and supplies EA for an item without a unit", () => {
    const csv = exportCatalogCsv([
      {
        id: "item-active",
        name: "=2+2",
        sku: "+NO-UNIT-1",
        category: "Test",
        unitPrice: 5,
      },
      {
        id: "item-apostrophe",
        name: "'=literal text",
        sku: "'+LITERAL-SKU",
        category: "Test",
        unitPrice: 6,
      },
    ]);

    expect(csv).toContain("'=2+2,'+NO-UNIT-1,Test,EA,5");
    expect(csv).toContain("'=literal text,'+LITERAL-SKU,Test,EA,6");
    let id = 0;
    const imported = importCatalogCsv(csv, [], () => `item-${id += 1}`);
    expect(imported.items[0]).toMatchObject({ name: "'=2+2", sku: "'+NO-UNIT-1", unit: "EA" });
    expect(imported.items[1]).toMatchObject({ name: "'=literal text", sku: "'+LITERAL-SKU", unit: "EA" });
  });
});