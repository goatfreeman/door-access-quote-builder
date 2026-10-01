import { Children, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogPanel, EquipmentCategoryStrip, QuickQuoteBuilderSkeleton, QuoteLines, TakeoffStageBar, TemplateConfigureDialog, customTemplateSelection, packageLineIds, quoteEntryStep, quoteShowsCatalog, quoteWorkspaceStep } from "./quick-quote-builder";
import type { QuoteLine } from "@/lib/types";

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

  it("keeps equipment results and category choices in separate scrollable regions", () => {
    const html = renderToStaticMarkup(
      <CatalogPanel
        items={[]}
        catalogItems={[]}
        templates={[]}
        allCategories={[]}
        categories={["All", "Readers", "Locks"]}
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
    expect(html).toContain('aria-label="Equipment categories"');
    expect(html).toContain("catalog-category-strip");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Readers");
    expect(html).toContain("Locks");
    expect(html).not.toContain('aria-label="Filter categories"');
  });

  it("selects every equipment category directly from the horizontal list", () => {
    const setCategory = vi.fn();
    const strip = EquipmentCategoryStrip({
      categories: ["All", "Readers", "Locks"],
      category: "Readers",
      setCategory,
    });
    const buttons = Children.toArray(strip.props.children).filter(
      (child): child is ReactElement<{ "aria-pressed": boolean; onClick: () => void }> =>
        isValidElement<{ "aria-pressed": boolean; onClick: () => void }>(child),
    );

    expect(buttons.map((button) => button.props["aria-pressed"])).toEqual([false, true, false]);
    buttons.forEach((button) => button.props.onClick());
    expect(setCategory.mock.calls).toEqual([["All"], ["Readers"], ["Locks"]]);
  });

  it("renders only one active All choice when catalog data also uses that category name", () => {
    const strip = EquipmentCategoryStrip({
      categories: ["All", "All", "Readers"],
      category: "All",
      setCategory: vi.fn(),
    });
    const buttons = Children.toArray(strip.props.children).filter(
      (child): child is ReactElement<{ "aria-pressed": boolean }> =>
        isValidElement<{ "aria-pressed": boolean }>(child),
    );

    expect(buttons).toHaveLength(2);
    expect(buttons.filter((button) => button.props["aria-pressed"])).toHaveLength(1);
  });

  it("uses a searchable catalog instead of an item option menu for template products", () => {
    const html = renderToStaticMarkup(
      <TemplateConfigureDialog
        template={{ id: "template-1", name: "Door package", description: "", lines: [], categoryRequirements: [{ id: "reader", category: "Reader", quantity: 1 }] }}
        items={[
          { id: "reader-1", name: "Standard reader", sku: "R-100", category: "Reader", unitPrice: 100 },
          { id: "reader-2", name: "Keypad reader", sku: "R-200", category: "Reader", unitPrice: 150 },
        ]}
        categories={["Reader"]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Product catalog for Reader"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('placeholder="Search Reader products"');
    expect(html).toContain('aria-label="Select Standard reader, R-100"');
    expect(html).toContain("template-product-results");
    expect(html).toContain("R-100");
    expect(html).toContain("R-200");
    expect(html).toContain("0 of 1 categories selected");
    expect(html).not.toContain("<select");
  });

  it("preserves custom product details when the active custom choice is selected again", () => {
    const current = { requirementId: "reader", quantity: 2, customItem: { name: "Existing reader", sku: "CUSTOM-1", unitPrice: 45, category: "Reader" } };

    expect(customTemplateSelection(current, "reader", "Reader")).toEqual(current);
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

  it("opens every quote directly in the Takeoff Ledger equipment workspace", () => {
    expect(quoteEntryStep(true)).toBe("customize");
    expect(quoteEntryStep(false)).toBe("customize");
    expect(quoteShowsCatalog("customize")).toBe(true);
    expect(quoteShowsCatalog("review")).toBe(true);
    expect(quoteShowsCatalog("finalize")).toBe(false);
    expect(quoteWorkspaceStep("pick")).toBe("customize");
    expect(quoteWorkspaceStep("review")).toBe("review");
    expect(quoteWorkspaceStep("unexpected")).toBe("customize");
  });
});
