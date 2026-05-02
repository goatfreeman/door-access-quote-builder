import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { parseCatalogItemsCsv } from "@/lib/item-csv";

type Collection = "items" | "templates" | "quotes" | "settings";

const collections = new Set<Collection>(["items", "templates", "quotes", "settings"]);
const databaseName = process.env.MONGODB_DB ?? "quick_quote_builder";
const memoryStore = globalThis as typeof globalThis & {
  quickQuoteMemoryStore?: Partial<Record<Collection, unknown>>;
  quickQuoteMongoClient?: Promise<MongoClient>;
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
  const database = await getMongoDatabase();

  if (!database) {
    getMemoryStore()[collection] = value;
    return;
  }

  await database.collection(collection).updateOne({ _id: collection }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
}

async function readStoredValue(collection: Collection) {
  const database = await getMongoDatabase();

  if (!database) {
    const value = getMemoryStore()[collection];
    return value === undefined ? null : value;
  }

  const document = await database.collection<{ _id: string; value?: unknown }>(collection).findOne({ _id: collection });
  return document?.value ?? null;
}

async function readSeedItems() {
  const csv = await readFile(join(process.cwd(), "public", "data", "item-database.csv"), "utf8");
  return parseCatalogItemsCsv(csv);
}

async function getMongoDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  memoryStore.quickQuoteMongoClient ??= new MongoClient(uri).connect();
  const client = await memoryStore.quickQuoteMongoClient;
  return client.db(databaseName);
}
