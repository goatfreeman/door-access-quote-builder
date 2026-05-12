import { adiPlugin } from "./adi";
import { serviceTitanPlugin } from "./service-titan";

export const integrationPlugins = [serviceTitanPlugin, adiPlugin];

export function getIntegrationPluginStatuses() {
  return integrationPlugins.map((plugin) => plugin.getStatus());
}
