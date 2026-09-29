import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminItemImport, formatImportFailure, parseImportSuccess } from "./admin-item-import";

describe("AdminItemImport", () => {
  it("shows the controlled CSV format and import action", () => {
    const html = renderToStaticMarkup(<AdminItemImport />);
    expect(html).toContain("Import catalog CSV");
    expect(html).toContain("name,sku,category,unit,price,adi,msrp,inventory,link,notes");
    expect(html).toContain('type="file"');
    expect(html).toContain("Export items");
  });

  it("formats structured API errors with the stage, HTTP status, and request identifier", () => {
    expect(formatImportFailure(400, "Bad Request", JSON.stringify({
      error: "Database import function is not installed.",
      stage: "write catalog",
    }), "iad1::request-1")).toBe(
      "Import failed during write catalog (HTTP 400): Database import function is not installed. Request ID: iad1::request-1",
    );
  });

  it("reports unreadable server responses without exposing response markup", () => {
    expect(formatImportFailure(500, "Internal Server Error", "<html>failure</html>"))
      .toBe("Import failed (HTTP 500): The server returned an unreadable error response.");
  });

  it("handles null JSON responses without throwing property-access errors", () => {
    expect(formatImportFailure(500, "Internal Server Error", "null"))
      .toBe("Import failed (HTTP 500): The server did not provide an error description.");
    expect(() => parseImportSuccess("null"))
      .toThrow("Import completed, but the server response did not include valid item counts.");
  });
});