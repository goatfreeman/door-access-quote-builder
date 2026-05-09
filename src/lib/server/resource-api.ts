import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/lib/auth-types";
import type { CatalogItem, DraftQuote, QuoteTemplate, SavedQuote, UserSessionRecord } from "@/lib/types";
import { readCollection, writeCollection, type StoreCollection } from "@/lib/server/nosql-store";

export type ApiResourceName = "items" | "templates" | "quotes" | "drafts" | "sessions";
type ResourceRecord = CatalogItem | QuoteTemplate | SavedQuote | DraftQuote | UserSessionRecord;

const resources = new Set<ApiResourceName>(["items", "templates", "quotes", "drafts", "sessions"]);
const softDeleteResources = new Set<ApiResourceName>(["items", "quotes"]);
const userScopedResources = new Set<ApiResourceName>(["drafts", "sessions"]);

export function isApiResource(value: string): value is ApiResourceName {
  return resources.has(value as ApiResourceName);
}

export async function listResource(resource: ApiResourceName, user: SessionUser, includeDeleted = false) {
  const records = await readResource(resource);
  return records.filter((record) => {
    if (!includeDeleted && hasDeletedAt(record) && record.deletedAt) return false;
    if (resource === "drafts") return "owner" in record && (record.owner === user.id || record.owner === user.name);
    if (resource === "sessions") return "userId" in record && (record.userId === user.id || user.role === "admin");
    return true;
  });
}

export async function getResource(resource: ApiResourceName, id: string, user: SessionUser) {
  const records = await listResource(resource, user, true);
  return records.find((record) => record.id === id) ?? null;
}

export async function createResource(resource: ApiResourceName, body: unknown, user: SessionUser) {
  const records = await readResource(resource);
  const now = new Date().toISOString();
  const next = normalizeRecord(resource, body, user, now);
  if (records.some((record) => record.id === next.id)) {
    throw new Error(`${resource} record already exists`);
  }
  await writeResource(resource, [next, ...records]);
  return next;
}

export async function updateResource(resource: ApiResourceName, id: string, body: unknown, user: SessionUser) {
  const records = await readResource(resource);
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) return null;
  const current = records[index];
  if (!canWriteRecord(resource, current, user)) return "forbidden" as const;

  const patch = isObject(body) ? body : {};
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: "updatedAt" in current ? new Date().toISOString() : (patch.updatedAt as string | undefined),
  } as ResourceRecord;
  const next = [...records];
  next[index] = updated;
  await writeResource(resource, next);
  return updated;
}

export async function deleteResource(resource: ApiResourceName, id: string, user: SessionUser) {
  const records = await readResource(resource);
  const record = records.find((item) => item.id === id);
  if (!record) return null;
  if (!canWriteRecord(resource, record, user)) return "forbidden" as const;

  if (softDeleteResources.has(resource)) {
    const deletedAt = new Date().toISOString();
    const next = records.map((item) => {
      if (item.id !== id) return item;
      return "updatedAt" in item ? ({ ...item, deletedAt, updatedAt: deletedAt } as ResourceRecord) : ({ ...item, deletedAt } as ResourceRecord);
    });
    await writeResource(resource, next);
    return next.find((item) => item.id === id) ?? null;
  }

  await writeResource(resource, records.filter((item) => item.id !== id));
  return record;
}

async function readResource(resource: ApiResourceName) {
  const records = await readCollection(resource as StoreCollection);
  return Array.isArray(records) ? (records as ResourceRecord[]) : [];
}

async function writeResource(resource: ApiResourceName, records: ResourceRecord[]) {
  await writeCollection(resource as StoreCollection, records);
}

function normalizeRecord(resource: ApiResourceName, body: unknown, user: SessionUser, now: string): ResourceRecord {
  const value = isObject(body) ? body : {};
  const id = typeof value.id === "string" && value.id.trim() ? value.id : `${resource}-${randomUUID()}`;

  if (resource === "drafts") {
    return { ...value, id, owner: user.id, ownerName: user.name, createdAt: stringOr(value.createdAt, now), updatedAt: now } as DraftQuote;
  }

  if (resource === "sessions") {
    return { ...value, id, userId: user.id, userName: user.name, createdAt: stringOr(value.createdAt, now), lastSeenAt: now } as UserSessionRecord;
  }

  if (resource === "quotes") {
    return { ...value, id, createdAt: stringOr(value.createdAt, now), updatedAt: now, updatedBy: user.id, updatedByName: user.name } as SavedQuote;
  }

  if (resource === "templates") {
    return { ...value, id, createdBy: user.id, createdByName: user.name, updatedBy: user.id, updatedByName: user.name } as QuoteTemplate;
  }

  return { ...value, id } as CatalogItem;
}

function canWriteRecord(resource: ApiResourceName, record: ResourceRecord, user: SessionUser) {
  if (user.role === "admin") return true;
  if (!userScopedResources.has(resource)) return true;
  if (resource === "drafts") return "owner" in record && (record.owner === user.id || record.owner === user.name);
  if (resource === "sessions") return "userId" in record && record.userId === user.id;
  return false;
}

function hasDeletedAt(record: ResourceRecord): record is ResourceRecord & { deletedAt?: string } {
  return "deletedAt" in record;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
