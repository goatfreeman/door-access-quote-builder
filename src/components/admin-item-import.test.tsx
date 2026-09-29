import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminItemImport } from "./admin-item-import";

describe("AdminItemImport", () => {
  it("shows the controlled CSV format and import action", () => {
    const html = renderToStaticMarkup(<AdminItemImport />);
    expect(html).toContain("Import catalog CSV");
    expect(html).toContain("name,sku,category,unit,price,adi,msrp,inventory,notes");
    expect(html).toContain('type="file"');
  });
});