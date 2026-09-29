import { describe, expect, it } from "vitest";
import type { CatalogItem } from "./types";
import { importCatalogCsv } from "./catalog-import";

describe("importCatalogCsv", () => {
  it("maps the required CSV columns and preserves ADI and unit values", () => {
    const result = importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\r\nComNet SFP,CNFE2MC/2,Media Converter,EA,125.50,ADI-001,199.99,4,https://example.com/item",
      [],
      () => "item-new",
    );

    expect(result).toEqual({
      items: [{
        id: "item-new",
        name: "ComNet SFP",
        sku: "CNFE2MC/2",
        category: "Media Converter",
        unit: "EA",
        unitPrice: 125.5,
        adi: "ADI-001",
        msrp: 199.99,
        inventory: 4,
        notes: "https://example.com/item",
      }],
      changedItems: [{
        id: "item-new",
        name: "ComNet SFP",
        sku: "CNFE2MC/2",
        category: "Media Converter",
        unit: "EA",
        unitPrice: 125.5,
        adi: "ADI-001",
        msrp: 199.99,
        inventory: 4,
        notes: "https://example.com/item",
      }],
      added: 1,
      updated: 0,
    });
  });

  it("updates an existing item by case-insensitive SKU without changing its id", () => {
    const existing: CatalogItem = {
      id: "item-existing",
      name: "Old name",
      sku: "abc-1",
      category: "Old",
      unitPrice: 1,
      vendor: "ComNet",
      deletedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nNew name,ABC-1,Fiber,EA,12.25,,,2,",
      [existing],
      () => "unused",
    );

    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.items[0]).toMatchObject({ id: "item-existing", name: "New name", sku: "ABC-1", unitPrice: 12.25 });
    expect(result.items[0].vendor).toBe("ComNet");
    expect(result.items[0].deletedAt).toBeUndefined();
  });

  it("supports quoted commas and rejects duplicate SKUs", () => {
    const csv = "name,sku,category,unit,price,adi,msrp,inventory,notes\n\"Converter, multimode\",MM-1,Fiber,EA,10,,,1,\"Link, with note\"\nOther,mm-1,Fiber,EA,11,,,1,";
    expect(() => importCatalogCsv(csv, [], () => "item-new")).toThrow("Duplicate SKU on row 3");
  });

  it("rejects a file that does not have the exact required header set", () => {
    expect(() => importCatalogCsv("name,sku,category,price\nItem,A-1,Fiber,1", [], () => "item-new"))
      .toThrow("Missing CSV columns: unit, adi, msrp, inventory, notes");
  });

  it("rejects duplicate headers and rows with the wrong number of cells", () => {
    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,name\nItem,A-1,Fiber,EA,1,,,1,Duplicate",
      [],
      () => "item-new",
    )).toThrow("Duplicate CSV column: name");

    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nWidget,W1,Fiber,EA,1,000,100,2,4,link",
      [],
      () => "item-new",
    )).toThrow("CSV row 2 must contain exactly 9 cells");
  });

  it("rejects quotes inside unquoted fields and text after a closing quote", () => {
    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nItem,AB\"CD\",Fiber,EA,1,,,1,",
      [],
      () => "item-new",
    )).toThrow("CSV contains invalid quoting");

    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nItem,\"AB\"CD,Fiber,EA,1,,,1,",
      [],
      () => "item-new",
    )).toThrow("CSV contains invalid quoting");
  });

  it("rejects short rows even when every cell is empty", () => {
    expect(() => importCatalogCsv("name,sku,category,unit,price,adi,msrp,inventory,notes\n,,", []))
      .toThrow("CSV row 2 must contain exactly 9 cells");
    expect(() => importCatalogCsv('name,sku,category,unit,price,adi,msrp,inventory,notes\n""', []))
      .toThrow("CSV row 2 must contain exactly 9 cells");
  });

  it("rejects invalid or out-of-range database numbers", () => {
    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nItem,A-1,Fiber,EA,$,,,1,",
      [],
      () => "item-new",
    )).toThrow("price must be a nonnegative decimal number on row 2");

    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nItem,A-1,Fiber,EA,10000000000,,,1,",
      [],
      () => "item-new",
    )).toThrow("price exceeds the database limit on row 2");

    expect(() => importCatalogCsv(
      "name,sku,category,unit,price,adi,msrp,inventory,notes\nItem,A-1,Fiber,EA,1,,,2147483648,",
      [],
      () => "item-new",
    )).toThrow("inventory exceeds the database limit on row 2");
  });
});