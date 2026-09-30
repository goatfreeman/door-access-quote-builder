import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuoteCompatibilityPanel, showWorkspaceCompatibilityPanel, summarizeCompatibilityEntries } from "./quote-compatibility-panel";
import type { ItemVerificationEntry } from "./item-verification-panel";

function render(entries: ItemVerificationEntry[] = []) {
  return renderToStaticMarkup(
    <QuoteCompatibilityPanel
      currentQuoteSignature="item-a:1"
      entries={entries}
      onDismiss={() => undefined}
    />,
  );
}

describe("QuoteCompatibilityPanel", () => {
  it("presents compatibility as a compact quote exception ledger", () => {
    const html = render();

    expect(html).toContain("Compatibility ledger");
    expect(html).toContain("0 need review");
    expect(html).toContain("Automated evidence does not approve the design.");
    expect(html).toContain("Choose an item to start the first check.");
  });

  it("keeps pending, failed, and completed checks accessible", () => {
    const html = render([
      { id: "latest", phase: "loading", itemName: "Latest selected item", quoteSignature: "item-a:1" },
      { id: "older", phase: "error", itemName: "Earlier selected item", error: "Review unavailable", quoteSignature: "old" },
    ]);

    expect(html).toContain("Latest selected item");
    expect(html).toContain("Earlier selected item");
    expect(html).toContain("Review unavailable");
  });

  it("keeps compatibility feedback visible when equipment can change without the catalog", () => {
    expect(showWorkspaceCompatibilityPanel("finalize")).toBe(true);
    expect(showWorkspaceCompatibilityPanel("customize")).toBe(false);
  });

  it("summarizes checking, confirmed, and unresolved review entries", () => {
    expect(summarizeCompatibilityEntries([
      { id: "loading", phase: "loading", itemName: "Loading" },
      { id: "notice", phase: "notice", itemName: "Notice", message: "OPEN" },
      { id: "error", phase: "error", itemName: "Error", error: "Unavailable" },
      {
        id: "confirmed",
        phase: "complete",
        itemName: "Confirmed",
        quoteSignature: "current",
        result: {
          request: { manufacturer: "Maker", sourcePartNumber: "PART", normalizedLookupKey: "PART", description: "Part", relatedItems: [], question: "Check" },
          finalStatus: "CONFIRMED",
          decisionNotice: "Review required.",
          reports: [],
        },
      },
      {
        id: "stale",
        phase: "complete",
        itemName: "Stale",
        quoteSignature: "old",
        result: {
          request: { manufacturer: "Maker", sourcePartNumber: "OLD", normalizedLookupKey: "OLD", description: "Old", relatedItems: [], question: "Check" },
          finalStatus: "CONFIRMED",
          decisionNotice: "Review required.",
          reports: [],
        },
      },
      {
        id: "not-applicable",
        phase: "complete",
        itemName: "Not applicable",
        quoteSignature: "current",
        result: {
          request: { manufacturer: "Maker", sourcePartNumber: "NA", normalizedLookupKey: "NA", description: "N/A", relatedItems: [], question: "Check" },
          finalStatus: "NOT APPLICABLE",
          decisionNotice: "Review required.",
          reports: [],
        },
      },
    ], "current")).toEqual({ checking: 1, confirmed: 1, notApplicable: 1, needReview: 3 });
  });
});
