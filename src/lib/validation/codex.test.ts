import { describe, expect, it } from "vitest";
import { getCodexStatus, runCodexAgent } from "./codex";
import { getValidationStatus, runValidationAgent } from "./hosted";

describe("legacy adapter exports", () => {
  it("retains aliases for hosted validation", () => {
    expect(getCodexStatus).toBe(getValidationStatus);
    expect(runCodexAgent).toBe(runValidationAgent);
  });
});
