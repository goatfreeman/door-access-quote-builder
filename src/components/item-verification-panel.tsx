import type { CompatibilityResult } from "@/lib/validation/domain";

export type ItemVerificationEntry = (
  | { phase: "loading"; itemName: string }
  | { phase: "notice"; itemName: string; message: string }
  | { phase: "error"; itemName: string; error: string }
  | { phase: "complete"; itemName: string; result: CompatibilityResult }
) & { id: string; quoteSignature?: string };

export function quoteLineSignature(lines: Array<{ itemId: string; quantity: number }>) {
  const quantities = new Map<string, number>();
  for (const line of lines) quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
  return Array.from(quantities.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, quantity]) => `${itemId}:${quantity}`)
    .join("|");
}

export function replaceItemVerificationEntry(entries: ItemVerificationEntry[], id: string, next: ItemVerificationEntry) {
  return entries.map((entry) => entry.id === id ? next : entry);
}

export function ItemVerificationPanel({ entries, currentQuoteSignature, onDismiss }: { entries: ItemVerificationEntry[]; currentQuoteSignature: string; onDismiss: (id: string) => void }) {
  if (!entries.length) return null;
  return <div className="grid gap-3">{entries.map((entry) => (
    <ItemVerificationCard currentQuoteSignature={currentQuoteSignature} key={entry.id} state={entry} onDismiss={() => onDismiss(entry.id)} />
  ))}</div>;
}

function ItemVerificationCard({ state, currentQuoteSignature, onDismiss }: { state: ItemVerificationEntry; currentQuoteSignature: string; onDismiss: () => void }) {
  const stale = state.phase === "complete" && Boolean(state.quoteSignature) && state.quoteSignature !== currentQuoteSignature;
  const displayStatus = state.phase === "complete" && stale
    ? (["BLOCKED", "CONFLICT"].includes(state.result.finalStatus) ? state.result.finalStatus : "OPEN (stale result)")
    : state.phase === "complete" ? state.result.finalStatus : null;
  const tone = state.phase === "error"
    ? "border-red-300 bg-red-50"
    : state.phase === "complete" && state.result.finalStatus === "CONFIRMED" && !stale
      ? "border-teal-300 bg-teal-50"
      : "border-amber-300 bg-amber-50";

  return (
    <section className={`rounded-lg border p-4 ${tone}`} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-normal">Item compatibility check</p>
          <h3 className="mt-1 font-black">{state.itemName}</h3>
        </div>
        <button className="text-sm font-bold" onClick={onDismiss} type="button">Dismiss</button>
      </div>

      {state.phase === "loading" ? <p className="mt-3 text-sm">Checking required companion parts and compatibility with the current quote…</p> : null}
      {state.phase === "notice" ? <p className="mt-3 text-sm font-bold">{state.message}</p> : null}
      {state.phase === "error" ? <p className="mt-3 text-sm font-bold">{state.error}</p> : null}
      {state.phase === "complete" ? (
        <div className="mt-3 grid gap-3">
          {stale ? <p className="text-sm font-bold">OPEN: The quote changed after this review started. Run the check again before approval.</p> : null}
          <p className="text-sm"><strong>Status:</strong> {displayStatus}</p>
          {state.result.reports.map((report) => (
            <div className="rounded-lg border border-current/20 bg-white/70 p-3" key={report.role}>
              <p className="text-xs font-black uppercase">{report.role}</p>
              <p className="mt-1 text-sm">{report.summary}</p>
              {report.findings.map((finding, index) => (
                <div className="mt-3 border-t border-stone-200 pt-3" key={`${finding.title}-${index}`}>
                  <p className="font-black">{finding.title} — {finding.status}</p>
                  <p className="mt-1 text-sm">{finding.detail}</p>
                  {finding.affectedItems.length ? <p className="mt-1 text-sm"><strong>Items:</strong> {finding.affectedItems.join(", ")}</p> : null}
                  {finding.evidence.length ? <p className="mt-1 text-sm"><strong>Evidence:</strong> {finding.evidence.join("; ")}</p> : null}
                  <p className="mt-1 text-sm"><strong>Action:</strong> {finding.recommendedAction}</p>
                </div>
              ))}
              {report.sources.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.sources.map((source) => <a className="text-sm font-bold underline" href={source} key={source} rel="noreferrer" target="_blank">Source</a>)}
                </div>
              ) : null}
            </div>
          ))}
          <p className="text-sm font-bold">{state.result.decisionNotice}</p>
        </div>
      ) : null}
    </section>
  );
}