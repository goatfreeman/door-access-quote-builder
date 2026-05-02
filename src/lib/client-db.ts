export type DbCollection = "items" | "templates" | "quotes" | "settings";

export async function readDb<T>(collection: DbCollection, fallback: T): Promise<T> {
  try {
    const response = await fetch(`/api/db/${collection}`, { cache: "no-store" });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function writeDb(collection: DbCollection, value: unknown) {
  await fetch(`/api/db/${collection}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
