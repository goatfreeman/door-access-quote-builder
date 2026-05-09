import type { DebugLogEntry } from "@/lib/types";

type DebugLogInput = Omit<DebugLogEntry, "id" | "createdAt">;

function makeLogId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `log-${crypto.randomUUID()}`;
  return `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function writeDebugLog(entry: DebugLogInput) {
  const log: DebugLogEntry = {
    ...entry,
    id: makeLogId(),
    createdAt: new Date().toISOString(),
  };

  await fetch("/api/debug/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log),
  }).catch(() => undefined);
}
