import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { attachDatabasePool } from "@vercel/functions";
import { MongoClient } from "mongodb";
import { parseCatalogItemsCsv } from "@/lib/item-csv";

export type StoreCollection = "items" | "templates" | "quotes" | "settings" | "drafts" | "sessions" | "debugLogs";
type StoreDocument = {
  _id: StoreCollection;
  value?: unknown;
  updatedAt?: Date;
};

const collections = new Set<StoreCollection>(["items", "templates", "quotes", "settings", "drafts", "sessions", "debugLogs"]);
const databaseName = process.env.MONGODB_DB ?? "quick_quote_builder";
const memoryStore = globalThis as typeof globalThis & {
  quickQuoteMemoryStore?: Partial<Record<StoreCollection, unknown>>;
  quickQuoteMongoClient?: Promise<MongoClient>;
};

function getMemoryStore() {
  memoryStore.quickQuoteMemoryStore ??= {};
  return memoryStore.quickQuoteMemoryStore;
}

export function isCollection(value: string): value is StoreCollection {
  return collections.has(value as StoreCollection);
}

export function getStoreStatus() {
  return {
    provider: process.env.MONGODB_URI ? "MongoDB" : "Local memory fallback",
    databaseName: process.env.MONGODB_URI ? databaseName : "Not connected",
    persistent: Boolean(process.env.MONGODB_URI),
  };
}

export async function readCollection(collection: StoreCollection) {
  const stored = await readStoredValue(collection);
  if (stored !== null) return stored;
  if (collection === "items") return readSeedItems();
  if (collection === "settings") return {};
  if (collection === "drafts" || collection === "sessions" || collection === "debugLogs") return [];
  return [];
}

export async function writeCollection(collection: StoreCollection, value: unknown) {
  const database = await getMongoDatabase();

  if (!database) {
    getMemoryStore()[collection] = value;
    return;
  }

  await database.collection<StoreDocument>(collection).updateOne({ _id: collection }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
}

async function readStoredValue(collection: StoreCollection) {
  const database = await getMongoDatabase();

  if (!database) {
    const value = getMemoryStore()[collection];
    return value === undefined ? null : value;
  }

  const document = await database.collection<StoreDocument>(collection).findOne({ _id: collection });
  return document?.value ?? null;
}

async function readSeedItems() {
  const csv = await readFile(join(process.cwd(), "public", "data", "item-database.csv"), "utf8");
  return parseCatalogItemsCsv(csv);
}

async function getMongoDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!memoryStore.quickQuoteMongoClient) {
    const client = new MongoClient(uri);
    attachDatabasePool(client);
    memoryStore.quickQuoteMongoClient = client.connect();
  }

  const client = await memoryStore.quickQuoteMongoClient;
  return client.db(databaseName);
}
