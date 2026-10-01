import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogPanel, QuickQuoteBuilderSkeleton, QuoteLines, TakeoffStageBar, deterministicQuoteFindings, packageLineIds, quoteEntryStep } from "./quick-quote-builder";
import type { CatalogItem, QuoteLine, ServiceTitanSettings } from "@/lib/types";

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
    expect(html).toContain("catalog-ledger-controls");
  });

  it("removes every line in a template package from its schedule row", () => {
    const lines: QuoteLine[] = [
      { lineId: "line-1", itemId: "item-1", name: "Reader", sku: "R-1", packageId: "package-1", packageName: "Door package", quantity: 1, unitPrice: 100, notes: "" },
      { lineId: "line-2", itemId: "item-2", name: "Lock", sku: "L-1", packageId: "package-1", packageName: "Door package", quantity: 1, unitPrice: 200, notes: "" },
    ];
    const html = renderToStaticMarkup(
      <QuoteLines lines={lines} items={[]} onAddItemToPackage={vi.fn()} onUpdateLine={vi.fn()} onRemoveLine={vi.fn()} />,
    );

    expect(packageLineIds(lines)).toEqual(["line-1", "line-2"]);
    expect(html).toContain('aria-label="Remove Door package"');
    expect(html).toContain("lucide-trash2");
  });

  it("continues an unsaved quote at equipment customization", () => {
    expect(quoteEntryStep(true)).toBe("customize");
    expect(quoteEntryStep(false)).toBe("pick");
  });

  it("recalculates deterministic findings from the current quote contents", () => {
    const items: CatalogItem[] = [
      { id: "converter", name: "Singlemode converter", sku: "CONV-SM", category: "Media Converter", unitPrice: 1 },
      { id: "fiber", name: "Multimode fiber", sku: "FIBER-MM", category: "Fiber Cable", unitPrice: 1 },
    ];
    const settings: ServiceTitanSettings = {
      compatibilityItemAttributes: { converter: { fiber_mode: "singlemode" }, fiber: { fiber_mode: "multimode" } },
      compatibilityRules: [{ id: "fiber-mode", name: "Fiber mode", enabled: true, type: "attribute-match", source: { category: "Media Converter" }, target: { category: "Fiber Cable" }, attributeKey: "fiber_mode", status: "CONFLICT", message: "Mismatch", revision: 1 }],
    };
    const converter = { lineId: "line-converter", itemId: "converter", name: "Singlemode converter", sku: "CONV-SM", quantity: 1, unitPrice: 1, notes: "" };
    const fiber = { lineId: "line-fiber", itemId: "fiber", name: "Multimode fiber", sku: "FIBER-MM", quantity: 1, unitPrice: 1, notes: "" };

    expect(deterministicQuoteFindings([converter, fiber], items, settings)).toHaveLength(1);
    expect(deterministicQuoteFindings([converter], items, settings)).toEqual([]);
  });
});
