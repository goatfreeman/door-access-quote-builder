import { describe, expect, it } from "vitest";
import { isCodexValidationEnabled, isValidationEnabled } from "./config";

describe("hosted validation enable flag", () => {
  it("defaults off and requires explicit opt-in", () => {
    expect(isValidationEnabled({})).toBe(false);
    expect(isValidationEnabled({ OPENAI_VALIDATION_ENABLED: "true" })).toBe(true);
    expect(isValidationEnabled({ OPENAI_VALIDATION_ENABLED: "false" })).toBe(false);
  });

  it("supports the legacy enable flag without requiring isolation", () => {
    expect(isCodexValidationEnabled({ CODEX_VALIDATION_ENABLED: "true" })).toBe(true);
    const legacy = { CODEX_VALIDATION_ENABLED: "true", CODEX_VALIDATION_ISOLATED: "false", NODE_ENV: "production" };
    expect(isValidationEnabled(legacy)).toBe(true);
  });

  it("gives the new flag precedence including an explicit disable", () => {
    expect(isValidationEnabled({ OPENAI_VALIDATION_ENABLED: "false", CODEX_VALIDATION_ENABLED: "true" })).toBe(false);
    expect(isValidationEnabled({ OPENAI_VALIDATION_ENABLED: "true", CODEX_VALIDATION_ENABLED: "false" })).toBe(true);
  });
});
