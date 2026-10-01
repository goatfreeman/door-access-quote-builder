import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ write: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/server/nosql-store", () => ({
  readCollection: vi.fn(),
  writeCollection: mocks.write,
  isCollection: (name: string) => name === "settings",
}));
vi.mock("@/lib/server/session-ip", () => ({ sessionIpAddress: vi.fn() }));

import { PUT } from "../../app/api/db/[collection]/route";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("settings collection authorization", () => {
  it("rejects a non-admin settings write before using the service-role store", async () => {
    mocks.user.mockResolvedValue({ id: "user-1", name: "User", role: "user" });

    const response = await PUT(
      new Request("http://localhost/api/db/settings", { method: "PUT", body: JSON.stringify({ compatibilityRules: [] }) }),
      { params: Promise.resolve({ collection: "settings" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("allows an administrator to write settings", async () => {
    mocks.user.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });

    const response = await PUT(
      new Request("http://localhost/api/db/settings", { method: "PUT", body: JSON.stringify({ compatibilityRules: [] }) }),
      { params: Promise.resolve({ collection: "settings" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith("settings", { compatibilityRules: [] });
  });
});
