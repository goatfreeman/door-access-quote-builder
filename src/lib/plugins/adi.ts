import type { IntegrationPlugin, IntegrationPluginStatus } from "./types";

const requiredEnv = ["ADI_BASE_URL", "ADI_ACCOUNT_NUMBER", "ADI_API_KEY"];

export const adiPlugin: IntegrationPlugin = {
  id: "adi",
  name: "ADI MSRP",
  requiredEnv,
  getStatus() {
    return buildStatus("adi", "ADI MSRP", requiredEnv);
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
