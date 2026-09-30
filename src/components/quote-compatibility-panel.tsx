import { ItemVerificationPanel, type ItemVerificationEntry } from "./item-verification-panel";

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
  currentQuoteSignature,
  onDismiss,
}: {
  entries: ItemVerificationEntry[];
  currentQuoteSignature: string;
  onDismiss: (id: string) => void;
}) {
  const summary = summarizeCompatibilityEntries(entries, currentQuoteSignature);
  return (
    <section className="compatibility-ledger" aria-label="Equipment compatibility">
      <div className="compatibility-ledger-header">
        <div>
          <p className="compatibility-ledger-title">Compatibility ledger</p>
          <p className="compatibility-ledger-note">Exceptions before quote release</p>
        </div>
        <span className="compatibility-ledger-count">{summary.needReview} need review</span>
      </div>
      <div className="compatibility-ledger-metrics">
        <div><strong>{summary.needReview}</strong><span>Need review</span></div>
        <div><strong>{summary.checking}</strong><span>Checking</span></div>
        <div><strong>{summary.confirmed}</strong><span>Confirmed</span></div>
        <div><strong>{summary.notApplicable}</strong><span>N/A</span></div>
      </div>
      <details className="compatibility-ledger-details" open={summary.needReview > 0 || summary.checking > 0}>
        <summary>Review findings and evidence</summary>
        <div className="compatibility-ledger-results">
        {entries.length ? (
          <ItemVerificationPanel
            currentQuoteSignature={currentQuoteSignature}
            entries={entries}
            onDismiss={onDismiss}
          />
        ) : (
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
