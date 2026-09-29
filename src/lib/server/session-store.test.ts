import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSessionRecord } from "../types";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from }) }));
import { readCollection, writeCollection } from "./nosql-store";

const session: UserSessionRecord = {
  id: "session-1", userId: "11111111-1111-4111-8111-111111111111", userName: "User",
  deviceId: "22222222-2222-4222-8222-222222222222", deviceName: "Browser",
  createdAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => table === "profiles"
    ? { select: () => Promise.resolve({ data: [], error: null }) }
    : {
      select: () => ({ order: mocks.order }), upsert: mocks.upsert,
      delete: () => ({ not: () => Promise.resolve({ error: null }) }),
    });
});
afterEach(() => vi.unstubAllEnvs());

describe("Supabase session mapping", () => {
  it.each(["192.0.2.1", "2001:db8::1", undefined])("writes IP %j using the nullable database column", async (ipAddress) => {
    await writeCollection("sessions", [{ ...session, ipAddress }]);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ ip_address: ipAddress ?? null })]);
  });

  it.each(["192.0.2.1", "2001:db8::1", null, undefined])("reads IP %j, including old records", async (ipAddress) => {
    mocks.order.mockResolvedValue({ data: [{
      user_id: session.userId, device_id: session.deviceId, device_name: session.deviceName,
      created_at: session.createdAt, last_seen_at: session.lastSeenAt,
      ...(ipAddress === undefined ? {} : { ip_address: ipAddress }),
    }], error: null });
    const records = await readCollection("sessions") as UserSessionRecord[];
    expect(records[0].ipAddress).toBe(ipAddress ?? undefined);
    expect(JSON.parse(JSON.stringify(records))[0].ipAddress).toBe(ipAddress ?? undefined);
  });
});
