import { ItemVerificationPanel, type ItemVerificationEntry } from "./item-verification-panel";

export function showWorkspaceCompatibilityPanel(step: "pick" | "customize" | "review" | "finalize") {
  return step === "finalize";
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
  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-3" aria-label="Equipment compatibility">
      <p className="text-sm font-black text-sky-950">Equipment compatibility</p>
      <p className="mt-1 text-xs text-sky-900">
        Compatibility checks run automatically when you add catalog equipment to this quote.
      </p>
      <p className="mt-1 text-xs font-bold text-sky-950">
        Only product identifiers are sent. Client, project, quantity, price, and quote notes stay out of the review.
      </p>
      <div className="mt-3 max-h-80 overflow-y-auto">
        {entries.length ? (
          <ItemVerificationPanel
            currentQuoteSignature={currentQuoteSignature}
            entries={entries}
            onDismiss={onDismiss}
          />
        ) : (
          <p className="rounded-md border border-dashed border-sky-300 bg-white/70 p-3 text-center text-xs font-bold text-sky-900">
            Choose an item to start the first check.
          </p>
        )}
      </div>
    </section>
  );
}
