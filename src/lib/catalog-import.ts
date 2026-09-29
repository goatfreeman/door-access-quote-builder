import type { CatalogItem } from "./types";

const requiredHeaders = ["name", "sku", "category", "unit", "price", "adi", "msrp", "inventory", "link", "notes"] as const;
const maxDatabaseMoney = 9_999_999_999.99;
const maxDatabaseInteger = 2_147_483_647;

export type CatalogImportResult = {
  items: CatalogItem[];
  changedItems: CatalogItem[];
  added: number;
  updated: number;
};

export function importCatalogCsv(
  csv: string,
  existingItems: CatalogItem[],
  createId: () => string = () => `item-${globalThis.crypto.randomUUID()}`,
): CatalogImportResult {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (!rows.length) throw new Error("CSV file is empty");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const duplicateHeader = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeader) throw new Error(`Duplicate CSV column: ${duplicateHeader}`);
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}`);
  const unexpected = headers.filter((header) => !requiredHeaders.includes(header as (typeof requiredHeaders)[number]));
  if (unexpected.length) throw new Error(`Unexpected CSV columns: ${unexpected.join(", ")}`);

  const bySku = new Map(existingItems.map((item, index) => [normalizeSku(item.sku), index]));
  const importedSkus = new Set<string>();
  const items = [...existingItems];
  const changedItems: CatalogItem[] = [];
  let added = 0;
  let updated = 0;

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (row.length !== requiredHeaders.length) {
      throw new Error(`CSV row ${rowNumber} must contain exactly ${requiredHeaders.length} cells`);
    }
    const value = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));
    const skuKey = normalizeSku(required(value.sku, "sku", rowNumber));
    if (importedSkus.has(skuKey)) throw new Error(`Duplicate SKU on row ${rowNumber}`);
    importedSkus.add(skuKey);

    const currentIndex = bySku.get(skuKey);
    const currentItem = currentIndex === undefined ? undefined : items[currentIndex];
    const item: CatalogItem = {
      ...currentItem,
      id: currentItem?.id ?? createId(),
      name: required(value.name, "name", rowNumber),
      sku: value.sku,
      category: required(value.category, "category", rowNumber),
      unit: required(value.unit, "unit", rowNumber),
      unitPrice: money(value.price, "price", rowNumber, true) ?? 0,
      adi: value.adi || undefined,
      msrp: money(value.msrp, "msrp", rowNumber, false),
      inventory: integer(value.inventory, "inventory", rowNumber),
      link: value.link || undefined,
      notes: value.notes || undefined,
    };
    delete item.deletedAt;
    changedItems.push(item);

    if (currentIndex === undefined) {
      bySku.set(skuKey, items.length);
      items.push(item);
      added += 1;
    } else {
      items[currentIndex] = item;
      updated += 1;
    }
  });

  return { items, changedItems, added, updated };
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;
  let recordStarted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += character;
      }
      continue;
    }
    if (afterQuote) {
      if (character === ",") {
        row.push(cell);
        cell = "";
        afterQuote = false;
      } else if (character === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        afterQuote = false;
        recordStarted = false;
      } else if (character === "\r" && csv[index + 1] === "\n") {
        continue;
      } else {
        throw new Error("CSV contains invalid quoting");
      }
    } else if (character === '"') {
      if (cell) throw new Error("CSV contains invalid quoting");
      quoted = true;
      recordStarted = true;
    }
    else if (character === ",") {
      row.push(cell);
      cell = "";
      recordStarted = true;
    } else if (character === "\r" && csv[index + 1] === "\n") {
      continue;
    } else if (character === "\n") {
      if (recordStarted || cell || row.length) {
        row.push(cell);
        rows.push(row);
      }
      row = [];
      cell = "";
      recordStarted = false;
    } else {
      cell += character;
      recordStarted = true;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  if (recordStarted || cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function required(value: string, field: string, row: number) {
  if (!value) throw new Error(`${field} is required on row ${row}`);
  return value;
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

function money(value: string, field: string, row: number, requiredValue: boolean) {
  if (!value && !requiredValue) return undefined;
  if (!value) throw new Error(`${field} is required on row ${row}`);
  if (!/^\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`${field} must be a nonnegative decimal number on row ${row}`);
  }
  const parsed = Number(value.replace(/[$,]/g, ""));
  const rounded = Math.round(parsed * 100) / 100;
  if (!Number.isFinite(rounded)) throw new Error(`${field} must be a nonnegative decimal number on row ${row}`);
  if (rounded > maxDatabaseMoney) throw new Error(`${field} exceeds the database limit on row ${row}`);
  return rounded;
}

function integer(value: string, field: string, row: number) {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${field} must be a nonnegative integer on row ${row}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${field} must be a nonnegative integer on row ${row}`);
  if (parsed > maxDatabaseInteger) throw new Error(`${field} exceeds the database limit on row ${row}`);
  return parsed;
}