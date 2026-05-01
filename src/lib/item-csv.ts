import type { CatalogItem } from "./types";

export const itemDatabaseCsvPath = "/data/item-database.csv";

export async function loadCatalogItemsFromCsv(path = itemDatabaseCsvPath): Promise<CatalogItem[]> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return [];
  return parseCatalogItemsCsv(await response.text());
}

export function parseCatalogItemsCsv(csv: string): CatalogItem[] {
  const rows = parseCsvRows(csv).filter((row) => row.some((cell) => cell.trim()));
  const [headers, ...dataRows] = rows;
  if (!headers) return [];

  const headerIndex = new Map(headers.map((header, index) => [header.trim(), index]));
  const get = (row: string[], key: string) => row[headerIndex.get(key) ?? -1]?.trim() ?? "";

  return dataRows
    .map((row) => ({
      id: get(row, "id"),
      sku: get(row, "sku"),
      name: get(row, "name"),
      category: get(row, "category") || "Other",
      unitPrice: toNumber(get(row, "unitPrice")),
      msrp: optionalNumber(get(row, "msrp")),
      vendor: get(row, "vendor") || undefined,
      inventory: optionalNumber(get(row, "inventory")),
      notes: get(row, "notes") || undefined,
    }))
    .filter((item) => item.id && item.name);
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function optionalNumber(value: string) {
  if (!value) return undefined;
  return toNumber(value);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
