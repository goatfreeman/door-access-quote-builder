import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ItemsPage } from "./quick-quote-builder";

describe("ItemsPage", () => {
  it("keeps the item list in its own viewport-bounded scroll region", () => {
    const html = renderToStaticMarkup(
      <ItemsPage
        items={[{ id: "reader-1", name: "Reader", sku: "R-1", category: "Readers", unitPrice: 100 }]}
        categories={["Readers"]}
        setItems={vi.fn()}
        setSettings={vi.fn()}
        onDeleteItem={vi.fn(() => null)}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(html).toContain("items-catalog-panel flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden");
    expect(html).toContain("panel-header shrink-0");
    expect(html).toContain(
      "items-catalog-body grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1",
    );
    expect(html).toContain("items-catalog-filters grid min-h-0 content-start gap-3 overflow-y-auto");
    expect(html).toContain("items-catalog-list grid min-h-0 content-start gap-3 overflow-y-auto");
    expect(html).toContain('role="region" aria-label="Catalog items" tabindex="0"');
    expect(html).toContain("Reader");
    expect(html).toContain('data-item-editor-id="reader-1"');
  });

  it("uses a whole-panel scrolling fallback on short screens", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const normalizedCss = css.replace(/\s+/g, " ");

    expect(normalizedCss).toContain(
      "@media (max-height: 700px) { .items-catalog-panel { overflow-y: auto; overscroll-behavior: contain; }",
    );
    expect(normalizedCss).toContain(
      ".items-catalog-body { flex: none; min-height: max-content; overflow: visible; }",
    );
    expect(normalizedCss).toContain(
      ".items-catalog-list { min-height: 12rem; max-height: 20rem; }",
    );
  });
});
