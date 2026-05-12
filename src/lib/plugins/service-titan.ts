import type { IntegrationPlugin, IntegrationPluginStatus } from "./types";

const requiredEnv = ["SERVICE_TITAN_BASE_URL", "SERVICE_TITAN_TENANT_ID", "SERVICE_TITAN_CLIENT_ID", "SERVICE_TITAN_CLIENT_SECRET"];

export const serviceTitanPlugin: IntegrationPlugin = {
  id: "service-titan",
  name: "ServiceTitan",
  requiredEnv,
  getStatus() {
    return buildStatus("service-titan", "ServiceTitan", requiredEnv);
  },
};

function buildStatus(id: IntegrationPluginStatus["id"], name: string, envKeys: string[]): IntegrationPluginStatus {
  const missingEnv = envKeys.filter((key) => !process.env[key]);
  const connected = missingEnv.length === 0;
  return {
    id,
    name,
    enabled: connected,
    connected,
    running: connected,
    missingEnv,
    lastCheckedAt: new Date().toISOString(),
    detail: connected ? "Configured from Vercel environment variables." : "Missing required Vercel environment variables.",
  };
}
