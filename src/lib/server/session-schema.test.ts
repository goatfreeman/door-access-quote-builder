import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../docs/supabase-schema.sql", import.meta.url), "utf8");

describe("session database authorization", () => {
  it("adds nullable IP storage and blocks direct authenticated session writes", () => {
    expect(schema).toContain("alter table public.user_sessions add column if not exists ip_address text;");
    expect(schema).toContain("revoke insert, update, delete on public.user_sessions from authenticated;");
    expect(schema).not.toContain('create policy "sessions owner write"');
  });
});