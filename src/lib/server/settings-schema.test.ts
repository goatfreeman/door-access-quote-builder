import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../docs/supabase-schema.sql", import.meta.url), "utf8");

describe("profile role authorization", () => {
  it("prevents authenticated users from assigning their own administrator role", () => {
    expect(schema).toContain("revoke update on public.profiles from authenticated;");
    expect(schema).toContain("grant update (display_name) on public.profiles to authenticated;");
  });
});
