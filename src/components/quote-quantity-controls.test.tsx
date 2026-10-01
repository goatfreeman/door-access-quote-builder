/** @vitest-environment jsdom */

import { useState } from "react";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuoteLine } from "@/lib/types";
import { QuoteLines } from "./quick-quote-builder";

afterEach(cleanup);

const readerLine: QuoteLine = {
  lineId: "line-1",
  itemId: "item-1",
  name: "Reader",
  sku: "R-1",
  quantity: 2,
  unitPrice: 100,
  notes: "",
};

function QuoteLinesHarness() {
  const [lines, setLines] = useState([readerLine]);

  return (
    <div role="region" aria-label="Quote cart items" tabIndex={0}>
      <QuoteLines
        lines={lines}
        items={[]}
        onAddItemToPackage={vi.fn()}
        onUpdateLine={(lineId, patch) => {
          setLines((current) => current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)));
        }}
        onRemoveLine={(lineId) => setLines((current) => current.filter((line) => line.lineId !== lineId))}
      />
    </div>
  );
}

describe("inline quote quantity controls", () => {
  it("updates quantity and extension without opening the row", async () => {
    const user = userEvent.setup();
    const view = render(<QuoteLinesHarness />);
    expect(view.container.querySelector("details")).toBeNull();
    await user.click(view.getByRole("button", { name: "Increase Reader quantity" }));

    expect(view.container.querySelector("details")).toBeNull();
    expect(view.getByRole("group", { name: "Reader quantity: 3" })).toBeTruthy();
    expect(view.container.textContent).toContain("$300.00");
    expect(view.queryByRole("dialog")).toBeNull();
  });

  it("stops at zero and supports keyboard activation", async () => {
    const user = userEvent.setup();
    const view = render(<QuoteLinesHarness />);

    const decrease = view.getByRole("button", { name: "Decrease Reader quantity" });
    await user.click(decrease);
    await user.click(decrease);

    expect(view.getByRole("group", { name: "Reader quantity: 0" })).toBeTruthy();
    expect(decrease.hasAttribute("disabled")).toBe(true);

    const increase = view.getByRole("button", { name: "Increase Reader quantity" });
    increase.focus();
    await user.keyboard("{Enter}");

    expect(view.getByRole("group", { name: "Reader quantity: 1" })).toBeTruthy();
    expect(view.container.querySelector("details")).toBeNull();
    expect(view.queryByRole("dialog")).toBeNull();
  });

  it("opens the item editor as a full-screen dialog instead of expanding the row", async () => {
    const user = userEvent.setup();
    const view = render(<QuoteLinesHarness />);
    const editButton = view.getByRole("button", { name: "Edit Reader" });

    expect(view.container.querySelector("details")).toBeNull();
    await user.click(editButton);

    const dialog = view.getByRole("dialog", { name: "Edit Reader" });
    expect(dialog.className).toContain("quote-line-editor-overlay");
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).toContain("inset-0");
    expect(view.container.querySelector("details")).toBeNull();
    expect(dialog.contains(view.getByLabelText("Quantity"))).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    const closeButton = view.getByRole("button", { name: "Close Reader editor" });
    expect(document.activeElement).toBe(closeButton);
    const quantityInput = view.getByLabelText("Quantity");
    await user.clear(quantityInput);
    await user.type(quantityInput, "4");
    expect(view.getByRole("group", { name: "Reader quantity: 4" })).toBeTruthy();
    expect(view.baseElement.textContent).toContain("$400.00");

    const removeButton = view.getByRole("button", { name: "Remove" });
    removeButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard("{Escape}");
    expect(view.queryByRole("dialog", { name: "Edit Reader" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(editButton);

    await user.click(view.getByRole("button", { name: "Open Reader editor" }));
    expect(view.getByRole("dialog", { name: "Edit Reader" })).toBeTruthy();
    await user.click(view.getByRole("button", { name: "Close Reader editor" }));
    expect(view.queryByRole("dialog", { name: "Edit Reader" })).toBeNull();
  });

  it("returns focus to the quote cart when deleting the edited item", async () => {
    const user = userEvent.setup();
    const view = render(<QuoteLinesHarness />);
    const cart = view.getByRole("region", { name: "Quote cart items" });

    await user.click(view.getByRole("button", { name: "Edit Reader" }));
    await user.click(view.getByRole("button", { name: "Remove" }));

    expect(view.queryByRole("dialog", { name: "Edit Reader" })).toBeNull();
    expect(view.getByText("Add catalog items or choose a template to start.")).toBeTruthy();
    expect(document.activeElement).toBe(cart);
  });
});
