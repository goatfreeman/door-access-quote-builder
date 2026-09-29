import { describe, expect, it } from "vitest";
import { sessionIpAddress } from "./session-ip";

describe("sessionIpAddress", () => {
  it("prefers the deployment header and takes only its first address", () => {
    expect(sessionIpAddress(new Headers({
      "x-vercel-forwarded-for": " 2001:db8::1 , 192.0.2.2",
      "x-forwarded-for": "192.0.2.3",
    }))).toBe("2001:db8::1");
  });

  it("falls back to the first x-forwarded-for address", () => {
    expect(sessionIpAddress(new Headers({ "x-forwarded-for": " 192.0.2.1 , 192.0.2.2" }))).toBe("192.0.2.1");
  });

  it.each(["", "unknown", "999.1.1.1", "192.0.2.1:80", "[2001:db8::1]", ", 192.0.2.1"])("rejects invalid first address %j without falling back", (value) => {
    expect(sessionIpAddress(new Headers({ "x-vercel-forwarded-for": value, "x-forwarded-for": "192.0.2.1" }))).toBeUndefined();
    expect(sessionIpAddress(new Headers({ "x-forwarded-for": value }))).toBeUndefined();
  });

  it("ignores unrelated headers and missing headers", () => {
    expect(sessionIpAddress(new Headers({ "x-real-ip": "192.0.2.1", forwarded: "for=192.0.2.2" }))).toBeUndefined();
    expect(sessionIpAddress()).toBeUndefined();
  });
});
