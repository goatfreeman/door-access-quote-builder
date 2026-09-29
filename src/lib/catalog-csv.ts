import type { CatalogItem } from "./types";

export const catalogCsvHeader = ["name", "sku", "category", "unit", "price", "adi", "msrp", "inventory", "link", "notes"] as const;

export function exportCatalogCsv(items: CatalogItem[]) {
  const rows = items
    .filter((item) => !item.deletedAt)
    .map((item) => [
      item.name,
      item.sku,
      item.category,
      item.unit?.trim() || "EA",
      item.unitPrice,
      item.adi ?? "",
      item.msrp ?? "",
      item.inventory ?? "",
      item.link ?? "",
      item.notes ?? "",
    ]);

  return [catalogCsvHeader, ...rows]
    .map((row) => row.map((value) => csvCell(spreadsheetSafeText(String(value)))).join(","))
    .join("\r\n");
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function spreadsheetSafeText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
