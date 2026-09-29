import { describe, expect, it } from "vitest";
import { catalogImportFailure } from "./catalog-import-errors";

describe("catalogImportFailure", () => {
  it("returns controlled CSV validation details", () => {
    expect(catalogImportFailure(new Error("CSV row 8 must contain exactly 9 cells"), "validate CSV")).toEqual({
      error: "CSV row 8 must contain exactly 9 cells",
      stage: "validate CSV",
    });
  });

  it("identifies a missing Supabase import function", () => {
    expect(catalogImportFailure(
      new Error("Could not find the function public.import_catalog_items(p_items) in the schema cache"),
      "write catalog",
    )).toEqual({
      error: "The catalog database import function is not installed. Apply docs/supabase-schema.sql to the target Supabase database, then retry.",
      stage: "write catalog",
    });
  });

  it("does not expose an unknown database error", () => {
    expect(catalogImportFailure(new Error("connection detail with internal host"), "write catalog")).toEqual({
      error: "The database rejected the catalog import. Confirm the Supabase schema migration and server configuration, then retry.",
      stage: "write catalog",
    });
  });

  it("does not misclassify permission errors that mention the import function", () => {
    expect(catalogImportFailure(new Error("permission denied for function import_catalog_items"), "write catalog")).toEqual({
      error: "The database rejected the catalog import. Confirm the Supabase schema migration and server configuration, then retry.",
      stage: "write catalog",
    });
  });

  it("warns that the write completed for every verification failure", () => {
    expect(catalogImportFailure(
      new Error("Could not find the function public.import_catalog_items(p_items) in the schema cache"),
      "verify catalog",
    )).toEqual({
      error: "The database write finished, but the server could not verify the imported catalog.",
      stage: "verify catalog",
    });
  });
});