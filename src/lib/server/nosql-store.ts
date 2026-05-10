import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { attachDatabasePool } from "@vercel/functions";
import { MongoClient } from "mongodb";
import { parseCatalogItemsCsv } from "@/lib/item-csv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/schema-types";

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
  if (isSupabaseStoreEnabled()) {
    return {
      provider: "Supabase PostgreSQL",
      databaseName: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://supabase.local").hostname,
      persistent: true,
    };
  }

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
  if (isSupabaseStoreEnabled()) {
    const wroteToSupabase = await writeSupabaseStoredValue(collection, value);
    if (wroteToSupabase) return;
  }

  const database = await getMongoDatabase();

  if (!database) {
    getMemoryStore()[collection] = value;
    return;
  }

  await database.collection<StoreDocument>(collection).updateOne({ _id: collection }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
}

async function readStoredValue(collection: StoreCollection) {
  if (isSupabaseStoreEnabled()) {
    const stored = await readSupabaseStoredValue(collection);
    if (stored !== undefined && stored !== null) return stored;

    const legacyStored = await readLegacyStoredValue(collection);
    if (legacyStored !== null) {
      await writeSupabaseStoredValue(collection, legacyStored);
      return legacyStored;
    }

    if (stored === null) return null;
  }

  return readLegacyStoredValue(collection);
}

async function readLegacyStoredValue(collection: StoreCollection) {
  const database = await getMongoDatabase();

  if (!database) {
    const value = getMemoryStore()[collection];
    return value === undefined ? null : value;
  }

  const document = await database.collection<StoreDocument>(collection).findOne({ _id: collection });
  return document?.value ?? null;
}

async function readSupabaseStoredValue(collection: StoreCollection) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return undefined;

  const { data, error } = await supabase.from("app_settings").select("value").eq("key", storeKey(collection)).maybeSingle();
  if (error) return undefined;
  return data?.value ?? null;
}

async function writeSupabaseStoredValue(collection: StoreCollection, value: unknown) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;

  const { error } = await supabase.from("app_settings").upsert({
    key: storeKey(collection),
    value: toJson(value),
    updated_at: new Date().toISOString(),
  });

  return !error;
}

function isSupabaseStoreEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function storeKey(collection: StoreCollection) {
  return `collection:${collection}`;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
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
