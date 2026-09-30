import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuoteCompatibilityPanel, showWorkspaceCompatibilityPanel } from "./quote-compatibility-panel";
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
  it("tells users that compatibility checks run while they choose quote items", () => {
    const html = render();

    expect(html).toContain("Equipment compatibility");
    expect(html).toContain("Compatibility checks run automatically when you add catalog equipment to this quote.");
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
});
