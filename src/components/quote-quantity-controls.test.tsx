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
    <QuoteLines
      lines={lines}
      items={[]}
      onAddItemToPackage={vi.fn()}
      onUpdateLine={(lineId, patch) => {
        setLines((current) => current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)));
      }}
      onRemoveLine={vi.fn()}
    />
  );
}

describe("inline quote quantity controls", () => {
  it("updates quantity and extension without opening the row", async () => {
    const user = userEvent.setup();
    const view = render(<QuoteLinesHarness />);
    const details = view.container.querySelector("details");

    expect(details?.open).toBe(false);
    await user.click(view.getByRole("button", { name: "Increase Reader quantity" }));

    expect(details?.open).toBe(false);
    expect(view.getByRole("group", { name: "Reader quantity: 3" })).toBeTruthy();
    expect(view.container.textContent).toContain("$300.00");
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
    expect(view.container.querySelector("details")?.open).toBe(false);
  });
});
