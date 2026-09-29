"use client";

import { useState } from "react";

const csvHeader = "name,sku,category,unit,price,adi,msrp,inventory,notes";

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
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Catalog import failed");
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
        <p className="text-xs text-stone-600">The notes column can contain the manufacturer or distributor item link. Duplicate SKUs in one file are rejected.</p>
        {message ? <p className="rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-900">{message}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}
        <button className="button-primary w-fit" disabled={!file || busy} type="submit">
          {busy ? "Importing…" : "Import items"}
        </button>
      </form>
    </section>
  );
}