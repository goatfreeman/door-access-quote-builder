import { describe, expect, it } from "vitest";
import { isCodexValidationEnabled } from "./config";

describe("isCodexValidationEnabled", () => {
  it("requires the isolation assertion in development and production", () => {
    expect(isCodexValidationEnabled({ CODEX_VALIDATION_ENABLED: "true", NODE_ENV: "development" })).toBe(false);
    expect(
      isCodexValidationEnabled({
        CODEX_VALIDATION_ENABLED: "true",
        CODEX_VALIDATION_ISOLATED: "true",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("blocks production unless the worker isolation control is asserted", () => {
    expect(isCodexValidationEnabled({ CODEX_VALIDATION_ENABLED: "true", NODE_ENV: "production" })).toBe(false);
    expect(
      isCodexValidationEnabled({
        CODEX_VALIDATION_ENABLED: "true",
        CODEX_VALIDATION_ISOLATED: "true",
        NODE_ENV: "production",
      }),
    ).toBe(true);
  });
});