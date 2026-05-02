import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCatalogItemsCsv } from "@/lib/item-csv";

type Collection = "items" | "templates" | "quotes" | "settings";

const collections = new Set<Collection>(["items", "templates", "quotes", "settings"]);
const memoryStore = globalThis as typeof globalThis & {
  quickQuoteMemoryStore?: Partial<Record<Collection, unknown>>;
};

function getMemoryStore() {
  memoryStore.quickQuoteMemoryStore ??= {};
  return memoryStore.quickQuoteMemoryStore;
}

export function isCollection(value: string): value is Collection {
  return collections.has(value as Collection);
}

export async function readCollection(collection: Collection) {
  const stored = await readStoredValue(collection);
  if (stored !== null) return stored;
  if (collection === "items") return readSeedItems();
  if (collection === "settings") return {};
  return [];
}

export async function writeCollection(collection: Collection, value: unknown) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    getMemoryStore()[collection] = value;
    return;
  }

  const response = await fetch(`${url}/set/${storeKey(collection)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NoSQL write failed for ${collection}`);
  }
}

async function readStoredValue(collection: Collection) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    const value = getMemoryStore()[collection];
    return value === undefined ? null : value;
  }

  const response = await fetch(`${url}/get/${storeKey(collection)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NoSQL read failed for ${collection}`);
  }

  const payload = (await response.json()) as { result?: string | null };
  return payload.result ? JSON.parse(payload.result) : null;
}

async function readSeedItems() {
  const csv = await readFile(join(process.cwd(), "public", "data", "item-database.csv"), "utf8");
  return parseCatalogItemsCsv(csv);
}

function storeKey(collection: Collection) {
  return `quick-quote-builder:${collection}`;
}
