import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSessionRecord } from "../types";

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/server/nosql-store", () => ({
  readCollection: mocks.read, writeCollection: mocks.write, isCollection: (name: string) => name === "sessions",
}));
vi.mock("@/lib/server/resource-api", () => import("./resource-api"));
vi.mock("@/lib/server/session-ip", () => import("./session-ip"));

import { POST } from "../../app/api/v1/[resource]/route";
import { PATCH } from "../../app/api/v1/[resource]/[id]/route";
import { PUT } from "../../app/api/db/[collection]/route";

const user = { id: "user-1", name: "User" };
const session: UserSessionRecord = {
  id: "session-1", userId: user.id, userName: user.name, deviceId: "device-1", deviceName: "Browser",
  createdAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue(user);
  mocks.read.mockResolvedValue([]);
});

describe("authenticated session writes", () => {
  for (const method of ["POST", "PATCH", "PUT"] as const) {
    it.each([
      [{ "x-vercel-forwarded-for": "2001:db8::1", "x-forwarded-for": "192.0.2.2" }, "2001:db8::1"],
      [{ "x-forwarded-for": "192.0.2.1, 192.0.2.2" }, "192.0.2.1"],
      [{ "x-vercel-forwarded-for": "invalid", "x-forwarded-for": "192.0.2.2" }, undefined],
      [{}, undefined],
    ] as [Record<string, string>, string | undefined][])(`${method} replaces or clears JSON IP from server headers %j`, async (headers, expected) => {
      if (method !== "POST") mocks.read.mockResolvedValue([{ ...session, ipAddress: "192.0.2.99" }]);
      const forged = { ...session, ipAddress: "203.0.113.99" };
      const request = new Request("http://localhost/api/v1/sessions", {
        method, headers, body: JSON.stringify(method === "PUT" ? [forged] : forged),
      });
      const response = method === "POST"
        ? await POST(request, { params: Promise.resolve({ resource: "sessions" }) })
        : method === "PATCH"
          ? await PATCH(request, { params: Promise.resolve({ resource: "sessions", id: session.id }) })
          : await PUT(request, { params: Promise.resolve({ collection: "sessions" }) });
      expect(response.status).toBe(method === "POST" ? 201 : 200);
      const saved = mocks.write.mock.calls[0][1][0];
      expect(saved.ipAddress).toBe(expected);
      if (method !== "PUT") {
        expect((await response.json()).data.ipAddress).toBe(expected);
      }
    });

    it(`${method} rejects unauthenticated writes`, async () => {
      mocks.user.mockResolvedValue(null);
      const request = new Request("http://localhost/api/v1/sessions", { method, body: "{}" });
      const response = method === "POST"
        ? await POST(request, { params: Promise.resolve({ resource: "sessions" }) })
        : method === "PATCH"
          ? await PATCH(request, { params: Promise.resolve({ resource: "sessions", id: session.id }) })
          : await PUT(request, { params: Promise.resolve({ collection: "sessions" }) });
      expect(response.status).toBe(401);
      expect(mocks.write).not.toHaveBeenCalled();
    });
  }

  it("updates old sessions without an IP and preserves other sessions", async () => {
    const other = { ...session, id: "session-2", userId: "user-2", ipAddress: "192.0.2.2" };
    mocks.read.mockResolvedValue([session, other]);
    await PATCH(new Request("http://localhost/api/v1/sessions/session-1", {
      method: "PATCH", headers: { "x-forwarded-for": "192.0.2.1" }, body: "{}",
    }), { params: Promise.resolve({ resource: "sessions", id: session.id }) });
    expect(mocks.write).toHaveBeenCalledWith("sessions", [expect.objectContaining({
      id: session.id, userId: session.userId, userName: session.userName,
      deviceId: session.deviceId, deviceName: session.deviceName,
      createdAt: session.createdAt, ipAddress: "192.0.2.1",
    }), other]);
  });

  it("preserves session identity and server timestamps during PATCH", async () => {
    mocks.read.mockResolvedValue([session]);
    await PATCH(new Request("http://localhost/api/v1/sessions/session-1", {
      method: "PATCH",
      headers: { "x-vercel-forwarded-for": "192.0.2.1" },
      body: JSON.stringify({
        userId: "other-user", userName: "Other", deviceId: "other-device", createdAt: "2000-01-01T00:00:00Z",
        lastSeenAt: "2000-01-01T00:00:00Z", deviceName: "Updated browser", endedAt: "2000-01-01T00:00:00Z",
      }),
    }), { params: Promise.resolve({ resource: "sessions", id: session.id }) });
    const saved = mocks.write.mock.calls[0][1][0] as UserSessionRecord;
    expect(saved).toMatchObject({
      id: session.id, userId: session.userId, userName: session.userName, deviceId: session.deviceId,
      createdAt: session.createdAt, deviceName: "Updated browser", ipAddress: "192.0.2.1",
    });
    expect(saved.lastSeenAt).not.toBe("2000-01-01T00:00:00Z");
    expect(saved.endedAt).not.toBe("2000-01-01T00:00:00Z");
  });

  it("rejects a non-array legacy session collection without writing", async () => {
    const response = await PUT(new Request("http://localhost/api/db/sessions", {
      method: "PUT", body: JSON.stringify(session),
    }), { params: Promise.resolve({ collection: "sessions" }) });
    expect(response.status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
