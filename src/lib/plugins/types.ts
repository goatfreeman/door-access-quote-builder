export type IntegrationPluginStatus = {
  id: "service-titan" | "adi";
  name: string;
  enabled: boolean;
  connected: boolean;
  running: boolean;
  missingEnv: string[];
  lastCheckedAt: string;
  detail: string;
};

export type IntegrationPlugin = {
  id: IntegrationPluginStatus["id"];
  name: string;
  requiredEnv: string[];
  getStatus: () => IntegrationPluginStatus;
};
