import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminConsole } from "./admin-console";

vi.mock("@/components/admin-item-import", () => ({ AdminItemImport: () => null }));

describe("admin session IP display", () => {
  it.each(["192.0.2.1", "2001:db8::1", undefined])("renders IP %j with a legacy fallback", (ipAddress) => {
    const html = renderToStaticMarkup(<AdminConsole
      projects={[]} databaseStatus={{ provider: "Test", persistent: false }} items={[]} quotes={[]} drafts={[]}
      adminName="Admin" sessions={[{
        id: "session-1", userId: "user-1", userName: "User", deviceId: "device-1", deviceName: "Browser",
        createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), ipAddress,
      }]}
    />);
    expect(html).toContain(`IP address: ${ipAddress ?? "Unknown"}`);
  });
});
