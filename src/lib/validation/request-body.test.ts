import { describe, expect, it } from "vitest";
import { readJsonBodyLimited } from "./request-body";

describe("readJsonBodyLimited", () => {
  it("parses JSON below the byte limit", async () => {
    await expect(readJsonBodyLimited(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "ok" }),
    }), 100)).resolves.toEqual({ value: "ok" });
  });

  it("rejects input while streaming when the byte limit is exceeded", async () => {
    await expect(readJsonBodyLimited(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(100) }),
    }), 20)).rejects.toThrow("Request body exceeds 20 bytes");
  });
});