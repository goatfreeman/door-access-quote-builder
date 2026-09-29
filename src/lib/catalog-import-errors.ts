export type CatalogImportStage = "read request" | "read catalog" | "validate CSV" | "write catalog" | "verify catalog";

const inputErrorPattern = /^(CSV file is empty|Missing CSV|Unexpected CSV|CSV |Duplicate SKU|Duplicate CSV|\w+ (is required|must be|exceeds))/;

export function catalogImportFailure(error: unknown, stage: CatalogImportStage) {
  const message = error instanceof Error ? error.message : "Catalog import failed";
  if ((stage === "read request" || stage === "validate CSV") && inputErrorPattern.test(message)) {
    return { error: message, stage };
  }
  if (stage === "verify catalog") {
    return { error: "The database write finished, but the server could not verify the imported catalog.", stage };
  }
  if (/Supabase is not configured/i.test(message)) {
    return { error: "The catalog database is not configured on this server.", stage };
  }
  if (stage === "write catalog"
    && /import_catalog_items/i.test(message)
    && /(could not find (?:the )?function|function .* does not exist|PGRST202)/i.test(message)) {
    return {
      error: "The catalog database import function is not installed. Apply docs/supabase-schema.sql to the target Supabase database, then retry.",
      stage,
    };
  }
  if (/column .*(unit|adi).*does not exist|catalog_items.*(unit|adi)/i.test(message)) {
    return {
      error: "The catalog database is missing required import columns. Apply docs/supabase-schema.sql to the target Supabase database, then retry.",
      stage,
    };
  }
  if (/duplicate key value|catalog_items_sku_ci_unique/i.test(message)) {
    return {
      error: "The database contains a conflicting SKU. Remove the duplicate catalog SKU or complete the case-insensitive SKU migration, then retry.",
      stage,
    };
  }
  const stageErrors: Record<CatalogImportStage, string> = {
    "read request": "The server could not read the catalog import request.",
    "read catalog": "The server could not read the existing catalog. Confirm the Supabase connection, then retry.",
    "validate CSV": "The server could not validate the CSV file.",
    "write catalog": "The database rejected the catalog import. Confirm the Supabase schema migration and server configuration, then retry.",
    "verify catalog": "The database write finished, but the server could not verify the imported catalog.",
  };
  return { error: stageErrors[stage], stage };
}