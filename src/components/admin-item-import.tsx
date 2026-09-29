"use client";

import { useState } from "react";

const csvHeader = "name,sku,category,unit,price,adi,msrp,inventory,link,notes";

export function formatImportFailure(status: number, _statusText: string, responseText: string, requestId?: string | null) {
  let payload: { error?: unknown; stage?: unknown } = {};
  try {
    const parsed = JSON.parse(responseText) as unknown;
    payload = parsed !== null && typeof parsed === "object" ? parsed as { error?: unknown; stage?: unknown } : {};
  } catch {
    return `Import failed (HTTP ${status}): The server returned an unreadable error response.`;
  }
  const reason = typeof payload.error === "string" && payload.error.trim()
    ? payload.error.trim()
    : "The server did not provide an error description.";
  const stage = typeof payload.stage === "string" && payload.stage.trim() ? ` during ${payload.stage.trim()}` : "";
  const reference = requestId?.trim() ? ` Request ID: ${requestId.trim()}` : "";
  return `Import failed${stage} (HTTP ${status}): ${reason}${reference}`;
}

export function parseImportSuccess(responseText: string) {
  let result: unknown;
  try {
    result = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error("Import completed, but the server returned an unreadable success response.");
  }
  if (result === null || typeof result !== "object") {
    throw new Error("Import completed, but the server response did not include valid item counts.");
  }
  const counts = result as { added?: unknown; updated?: unknown };
  if (typeof counts.added !== "number" || typeof counts.updated !== "number") {
    throw new Error("Import completed, but the server response did not include valid item counts.");
  }
  return { added: counts.added, updated: counts.updated };
}

export function AdminItemImport({ onImported = () => window.location.reload() }: { onImported?: () => void } = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function importFile(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: await file.text() }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(formatImportFailure(
          response.status,
          response.statusText,
          responseText,
          response.headers.get("x-vercel-id") || response.headers.get("x-request-id"),
        ));
      }
      const result = parseImportSuccess(responseText);
      setMessage(`Import complete: ${result.added} added and ${result.updated} updated.`);
      setFile(null);
      onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catalog import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Import catalog CSV</h2>
          <p>Add new catalog items or update existing items with the same SKU.</p>
        </div>
      </div>
      <form className="grid gap-3 p-4" onSubmit={importFile}>
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs font-black uppercase text-stone-500">Required header</p>
          <code className="mt-1 block overflow-x-auto text-sm">{csvHeader}</code>
        </div>
        <label className="grid gap-1 text-sm font-bold">
          CSV file
          <input
            accept=".csv,text/csv"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <p className="text-xs text-stone-600">The link column can contain the manufacturer or distributor item URL. The notes column is for item notes. Duplicate SKUs in one file are rejected.</p>
        {message ? <p className="rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-900">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}
        <button className="button-primary w-fit" disabled={!file || busy} type="submit">
          {busy ? "Importing…" : "Import items"}
        </button>
      </form>
    </section>
  );
}