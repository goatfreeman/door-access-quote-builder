import { isCollection, readCollection, writeCollection } from "@/lib/server/nosql-store";
import { getSessionUser } from "@/lib/server/auth";
import type { SessionUser } from "@/lib/auth-types";
import type { DraftQuote, UserSessionRecord } from "@/lib/types";

export async function GET(_request: Request, context: { params: Promise<{ collection: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { collection } = await context.params;
  if (!isCollection(collection)) {
    return Response.json({ error: "Unknown collection" }, { status: 404 });
  }

  try {
    const records = await readCollection(collection);
    if (collection === "drafts" && Array.isArray(records)) return Response.json(filterDraftsForUser(records, user));
    if (collection === "sessions" && Array.isArray(records)) return Response.json(filterSessionsForUser(records, user));
    return Response.json(records);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Read failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ collection: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { collection } = await context.params;
  if (!isCollection(collection)) {
    return Response.json({ error: "Unknown collection" }, { status: 404 });
  }

  try {
    const payload = await request.json();
    if (collection === "drafts" && Array.isArray(payload)) {
      const current = await readCollection(collection);
      const sharedDrafts = Array.isArray(current) ? current.filter((record) => !isDraftOwnedByUser(record, user)) : [];
      await writeCollection(collection, [...payload.map((record) => normalizeDraftOwner(record, user)), ...sharedDrafts]);
      return Response.json({ ok: true });
    }

    if (collection === "sessions" && Array.isArray(payload)) {
      const current = await readCollection(collection);
      const sharedSessions = Array.isArray(current) ? current.filter((record) => !isSessionOwnedByUser(record, user)) : [];
      await writeCollection(collection, [...payload.map((record) => normalizeSessionOwner(record, user)), ...sharedSessions]);
      return Response.json({ ok: true });
    }

    await writeCollection(collection, payload);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Write failed" }, { status: 500 });
  }
}

function filterDraftsForUser(records: unknown[], user: SessionUser) {
  return records.filter((record) => isDraftOwnedByUser(record, user));
}

function filterSessionsForUser(records: unknown[], user: SessionUser) {
  return records.filter((record) => isSessionOwnedByUser(record, user));
}

function isDraftOwnedByUser(record: unknown, user: SessionUser): record is DraftQuote {
  return isObject(record) && (record.owner === user.id || record.owner === user.name);
}

function isSessionOwnedByUser(record: unknown, user: SessionUser): record is UserSessionRecord {
  return isObject(record) && record.userId === user.id;
}

function normalizeDraftOwner(record: unknown, user: SessionUser): DraftQuote {
  return { ...(isObject(record) ? record : {}), owner: user.id, ownerName: user.name } as DraftQuote;
}

function normalizeSessionOwner(record: unknown, user: SessionUser): UserSessionRecord {
  return { ...(isObject(record) ? record : {}), userId: user.id, userName: user.name } as UserSessionRecord;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
