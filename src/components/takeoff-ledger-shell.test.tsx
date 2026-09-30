import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogPanel, QuickQuoteBuilderSkeleton, TakeoffStageBar, quoteEntryStep } from "./quick-quote-builder";

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

  it("shows a simple loading notice instead of a simulated workspace", () => {
    const html = renderToStaticMarkup(<QuickQuoteBuilderSkeleton />);

    expect(html).toContain('aria-label="Loading estimating desk"');
    expect(html).toContain("Estimating Desk");
    expect(html).toContain("Loading quote workspace");
    expect(html).not.toContain("Equipment index");
    expect(html).not.toContain("Description / part number");
  });

  it("keeps equipment results in their own scrollable region", () => {
    const html = renderToStaticMarkup(
      <CatalogPanel
        items={[]}
        templates={[]}
        allCategories={[]}
        categories={["All"]}
        category="All"
        search=""
        setSearch={vi.fn()}
        setCategory={vi.fn()}
        onAdd={vi.fn()}
        onAddTemplate={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Equipment index results"');
    expect(html).toContain("catalog-ledger-results");
  });

  it("continues an unsaved quote at equipment customization", () => {
    expect(quoteEntryStep(true)).toBe("customize");
    expect(quoteEntryStep(false)).toBe("pick");
  });
});
