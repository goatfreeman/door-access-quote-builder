import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemVerificationPanel, quoteLineSignature, replaceItemVerificationEntry, type ItemVerificationEntry } from "./item-verification-panel";

describe("ItemVerificationPanel", () => {
  it("shows required companion parts and compatibility findings", () => {
    const state: ItemVerificationEntry = {
      id: "verification-1",
      quoteSignature: "item-comnet|patch",
      phase: "complete",
      itemName: "ComNet multimode converter",
      result: {
        request: {
          manufacturer: "ComNet",
          sourcePartNumber: "CNFE2MC/2",
          normalizedLookupKey: "CNFE2MC2",
          description: "ComNet multimode converter",
          relatedItems: ["MM-LC-LC-3M"],
          question: "Check required parts",
        },
        finalStatus: "OPEN",
        decisionNotice: "A qualified Caltron reviewer must approve the final compatibility decision.",
        reports: [{
          role: "tester",
          status: "OPEN",
          summary: "Verify the patch cable before release.",
          sources: ["https://www.comnet.net/example"],
          findings: [{
            status: "OPEN",
            title: "Fiber patch cable",
            detail: "Confirm multimode fiber and LC connectors.",
            affectedItems: ["CNFE2MC/2", "MM-LC-LC-3M"],
            evidence: ["Connector type not confirmed"],
            recommendedAction: "Use the manufacturer compatibility table.",
          }],
        }],
      },
    };

    const html = renderToStaticMarkup(<ItemVerificationPanel entries={[state, {
      id: "verification-2",
      phase: "loading",
      itemName: "Fiber patch cable",
    }, {
      id: "verification-3",
      phase: "notice",
      itemName: "Custom template item",
      message: "OPEN: Add this item to the controlled catalog before compatibility research.",
    }]} currentQuoteSignature="different-quote" onDismiss={() => undefined} />);
    expect(html).toContain("Item compatibility check");
    expect(html).toContain("Fiber patch cable");
    expect(html).toContain("Confirm multimode fiber and LC connectors");
    expect(html).toContain("qualified Caltron reviewer");
    expect(html).toContain("OPEN: Add this item to the controlled catalog");
    expect(html).toContain("OPEN: The quote changed after this review started");
  });

  it("updates only the matching request and does not restore a dismissed request", () => {
    const first: ItemVerificationEntry = { id: "first", phase: "loading", itemName: "First" };
    const second: ItemVerificationEntry = { id: "second", phase: "loading", itemName: "Second" };
    const completed: ItemVerificationEntry = { id: "first", phase: "error", itemName: "First", error: "Unavailable" };

    expect(replaceItemVerificationEntry([first, second], "first", completed)).toEqual([completed, second]);
    expect(replaceItemVerificationEntry([second], "first", completed)).toEqual([second]);
  });

  it("includes aggregate item quantities in the quote signature", () => {
    expect(quoteLineSignature([{ itemId: "b", quantity: 1 }, { itemId: "a", quantity: 2 }]))
      .toBe(quoteLineSignature([{ itemId: "a", quantity: 1 }, { itemId: "b", quantity: 1 }, { itemId: "a", quantity: 1 }]));
    expect(quoteLineSignature([{ itemId: "a", quantity: 2 }]))
      .not.toBe(quoteLineSignature([{ itemId: "a", quantity: 3 }]));
  });

  it("does not lower a stale BLOCKED result to OPEN", () => {
    const blocked: ItemVerificationEntry = {
      id: "blocked",
      phase: "complete",
      itemName: "Blocked item",
      quoteSignature: "old",
      result: {
        request: { manufacturer: "Maker", sourcePartNumber: "PART-1", normalizedLookupKey: "PART1", description: "Part", relatedItems: [], question: "Check" },
        finalStatus: "BLOCKED",
        decisionNotice: "Qualified review required.",
        reports: [],
      },
    };
    const html = renderToStaticMarkup(<ItemVerificationPanel currentQuoteSignature="new" entries={[blocked]} onDismiss={() => undefined} />);
    expect(html).toContain("Status:</strong> BLOCKED");
    expect(html).toContain("OPEN: The quote changed after this review started");
  });
});