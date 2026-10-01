import { ItemVerificationPanel, type ItemVerificationEntry } from "./item-verification-panel";
import type { DeterministicCompatibilityFinding } from "@/lib/compatibility-rules";

export function showWorkspaceCompatibilityPanel(step: "pick" | "customize" | "review" | "finalize") {
  return step === "finalize";
}

export function summarizeCompatibilityEntries(entries: ItemVerificationEntry[], currentQuoteSignature: string) {
  return entries.reduce((summary, entry) => {
    if (entry.phase === "loading") {
      summary.checking += 1;
      return summary;
    }
    const currentComplete = entry.phase === "complete" && (!entry.quoteSignature || entry.quoteSignature === currentQuoteSignature);
    if (currentComplete && entry.result.finalStatus === "CONFIRMED") {
      summary.confirmed += 1;
      return summary;
    }
    if (currentComplete && entry.result.finalStatus === "NOT APPLICABLE") {
      summary.notApplicable += 1;
      return summary;
    }
    summary.needReview += 1;
    return summary;
  }, { checking: 0, confirmed: 0, notApplicable: 0, needReview: 0 });
}

export function QuoteCompatibilityPanel({
  entries,
  deterministicFindings = [],
  currentQuoteSignature,
  onDismiss,
}: {
  entries: ItemVerificationEntry[];
  deterministicFindings?: DeterministicCompatibilityFinding[];
  currentQuoteSignature: string;
  onDismiss: (id: string) => void;
}) {
  const summary = summarizeCompatibilityEntries(entries, currentQuoteSignature);
  const deterministicNeedReview = deterministicFindings.filter((finding) => finding.status === "OPEN" || finding.status === "CONFLICT" || finding.status === "BLOCKED").length;
  const deterministicConfirmed = deterministicFindings.filter((finding) => finding.status === "CONFIRMED").length;
  const deterministicNotApplicable = deterministicFindings.filter((finding) => finding.status === "NOT APPLICABLE").length;
  const needReview = summary.needReview + deterministicNeedReview;
  const confirmed = summary.confirmed + deterministicConfirmed;
  const notApplicable = summary.notApplicable + deterministicNotApplicable;
  return (
    <section className="compatibility-ledger" aria-label="Equipment compatibility">
      <div className="compatibility-ledger-header">
        <div>
          <p className="compatibility-ledger-title">Compatibility ledger</p>
          <p className="compatibility-ledger-note">Exceptions before quote release</p>
        </div>
        <span className="compatibility-ledger-count">{needReview} need review</span>
      </div>
      <div className="compatibility-ledger-metrics">
        <div><strong>{needReview}</strong><span>Need review</span></div>
        <div><strong>{summary.checking}</strong><span>Checking</span></div>
        <div><strong>{confirmed}</strong><span>Confirmed</span></div>
        <div><strong>{notApplicable}</strong><span>N/A</span></div>
      </div>
      <details className="compatibility-ledger-details" open={deterministicFindings.length > 0 || needReview > 0 || summary.checking > 0}>
        <summary>Review findings and evidence</summary>
        <div className="compatibility-ledger-results">
        {deterministicFindings.length ? (
          <section className="mb-2 grid gap-2" aria-label="Rule-based compatibility findings">
            <p className="text-xs font-black uppercase tracking-wide text-stone-500">Rule-based checks</p>
            {deterministicFindings.map((finding) => (
              <article key={finding.id} className={`border p-3 text-sm ${finding.status === "CONFIRMED" || finding.status === "NOT APPLICABLE" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-stone-950">{finding.title}</strong>
                  <span className="border border-amber-400 bg-white px-2 py-0.5 text-[10px] font-black text-amber-950">{finding.status}</span>
                </div>
                <p className="mt-2 text-stone-700">{finding.message}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-stone-500">Revision {finding.ruleRevision}</p>
              </article>
            ))}
            <p className="text-[11px] font-bold text-stone-500">Rule-based evaluation runs locally and does not use AI.</p>
          </section>
        ) : null}
        {entries.length ? (
          <ItemVerificationPanel
            currentQuoteSignature={currentQuoteSignature}
            entries={entries}
            onDismiss={onDismiss}
          />
        ) : deterministicFindings.length ? null : (
          <p className="compatibility-ledger-empty">
            Choose an item to start the first check.
          </p>
        )}
        </div>
      </details>
      <p className="compatibility-ledger-boundary">Automated evidence does not approve the design.</p>
      <p className="compatibility-ledger-data">Only product identifiers are sent. Client, project, quantity, price, and quote notes stay out of the review.</p>
    </section>
  );
}
