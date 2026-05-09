export type DbCollection = "items" | "templates" | "quotes" | "settings" | "drafts" | "sessions" | "debugLogs";
type PendingWrite = {
  collection: DbCollection;
  value: unknown;
  updatedAt: string;
};

const offlineWriteQueueKey = "qqb.offline.writeQueue.v1";

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readPendingWrites(): PendingWrite[] {
  if (!canUseStorage()) return [];
  try {
    const stored = window.localStorage.getItem(offlineWriteQueueKey);
    return stored ? (JSON.parse(stored) as PendingWrite[]) : [];
  } catch {
    return [];
  }
}

function writePendingWrites(queue: PendingWrite[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(offlineWriteQueueKey, JSON.stringify(queue));
}

function queuePendingWrite(collection: DbCollection, value: unknown) {
  const current = readPendingWrites().filter((item) => item.collection !== collection);
  current.push({ collection, value, updatedAt: new Date().toISOString() });
  writePendingWrites(current);
}

function clearPendingWrite(collection: DbCollection) {
  writePendingWrites(readPendingWrites().filter((item) => item.collection !== collection));
}

async function putCollection(collection: DbCollection, value: unknown) {
  const response = await fetch(`/api/db/${collection}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    return;
  }
  if (!response.ok) throw new Error(`Database write failed for ${collection}`);
}

export async function readDb<T>(collection: DbCollection, fallback: T): Promise<T> {
  try {
    const response = await fetch(`/api/db/${collection}`, { cache: "no-store" });
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      return fallback;
    }
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function writeDb(collection: DbCollection, value: unknown) {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("Browser is offline");
    await putCollection(collection, value);
    clearPendingWrite(collection);
  } catch {
    queuePendingWrite(collection, value);
  }
}

export function getPendingWriteCount() {
  return readPendingWrites().length;
}

export async function syncPendingWrites() {
  const pending = readPendingWrites();
  if (!pending.length || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { synced: 0, pending: pending.length };
  }

  let synced = 0;
  for (const item of pending) {
    try {
      await putCollection(item.collection, item.value);
      clearPendingWrite(item.collection);
      synced += 1;
    } catch {
      break;
    }
  }

  return { synced, pending: readPendingWrites().length };
}
