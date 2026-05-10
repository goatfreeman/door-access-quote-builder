export type DbCollection = "items" | "templates" | "quotes" | "settings" | "drafts" | "sessions" | "debugLogs";

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
    if (!response.ok) throw new Error(`Database read failed for ${collection}`);
    return (await response.json()) as T;
  } catch (error) {
    throw error instanceof Error ? error : new Error(`Database read failed for ${collection}`);
  }
}

export async function writeDb(collection: DbCollection, value: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  await putCollection(collection, value);
}

export function getPendingWriteCount() {
  return 0;
}

export async function syncPendingWrites() {
  return { synced: 0, pending: 0 };
}
