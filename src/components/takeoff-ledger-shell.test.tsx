import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuickQuoteBuilderSkeleton, TakeoffStageBar, quoteEntryStep } from "./quick-quote-builder";

describe("takeoff ledger shell", () => {
  it("uses the three-stage takeoff workflow", () => {
    const html = renderToStaticMarkup(
      <TakeoffStageBar currentStep="review" onStep={vi.fn()} />,
    );

    expect(html).toContain("1 Equipment");
    expect(html).toContain("2 Pricing &amp; scope");
    expect(html).toContain("3 Review &amp; issue");
    expect(html).toContain('aria-current="step"');
  });

  it("loads with the same takeoff-ledger structure as the quote area", () => {
    const html = renderToStaticMarkup(<QuickQuoteBuilderSkeleton />);

    expect(html).toContain('aria-label="Loading estimating desk"');
    expect(html).toContain("Estimating Desk");
    expect(html).toContain("Equipment index");
    expect(html).toContain("Quote equipment");
    expect(html).toContain("Compatibility ledger");
    expect(html).toContain("Description / part number");
  });

  it("continues an unsaved quote at equipment customization", () => {
    expect(quoteEntryStep(true)).toBe("customize");
    expect(quoteEntryStep(false)).toBe("pick");
  });
});
