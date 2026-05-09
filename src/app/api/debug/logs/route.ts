import type { DebugLogEntry } from "@/lib/types";
import { getSessionUser } from "@/lib/server/auth";
import { readCollection, writeCollection } from "@/lib/server/nosql-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const logs = await readDebugLogs();
  return Response.json({ data: logs.slice(0, 200) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  const body = (await request.json().catch(() => null)) as Partial<DebugLogEntry> | null;
  const now = new Date().toISOString();
  const log: DebugLogEntry = {
    id: body?.id || `log-${crypto.randomUUID()}`,
    type: body?.type || "ui",
    level: body?.level || "info",
    message: body?.message || "Debug event",
    userId: body?.userId ?? user?.id,
    userName: body?.userName ?? user?.name,
    deviceId: body?.deviceId,
    deviceName: body?.deviceName,
    metadata: body?.metadata,
    createdAt: body?.createdAt || now,
  };

  const logs = await readDebugLogs();
  await writeCollection("debugLogs", [log, ...logs].slice(0, 500));
  return Response.json({ ok: true });
}

async function readDebugLogs() {
  const logs = await readCollection("debugLogs");
  return Array.isArray(logs) ? (logs as DebugLogEntry[]) : [];
}
