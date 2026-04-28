const { dataApi, memory, readBody, send } = require("./_store");
const { randomUUID } = require("crypto");

function getConfig(overrides = {}) {
  return {
    baseUrl: overrides.baseUrl || process.env.SERVICETITAN_BASE_URL,
    clientId: overrides.clientId || process.env.SERVICETITAN_CLIENT_ID,
    clientSecret: overrides.clientSecret || process.env.SERVICETITAN_CLIENT_SECRET,
    tenantId: overrides.tenantId || process.env.SERVICETITAN_TENANT_ID,
  };
}

function serviceTitanConfigured(config) {
  return Boolean(config.baseUrl && config.clientId && config.clientSecret && config.tenantId);
}

function mapServiceTitanItem(item) {
  return {
    id: `st-${item.id || item.sku || randomUUID()}`,
    sourceId: String(item.id || item.sku || ""),
    name: item.name || item.displayName || "ServiceTitan item",
    category: item.category || "Door Hardware",
    description: item.description || item.name || "",
    unitPrice: Number(item.price || item.unitPrice || 0),
    inventory: item.inventory ?? item.quantityAvailable ?? null,
    source: "ServiceTitan",
    lastSyncedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    return send(response, 405, { error: "Method not allowed" });
  }

  const config = getConfig(await readBody(request));

  if (!serviceTitanConfigured(config)) {
    return send(response, 200, {
      configured: false,
      message:
        "ServiceTitan sync endpoint is ready. Add SERVICETITAN_BASE_URL, SERVICETITAN_CLIENT_ID, SERVICETITAN_CLIENT_SECRET, and SERVICETITAN_TENANT_ID in Vercel.",
      items: memory.items,
    });
  }

  try {
    const tokenResponse = await fetch(`${config.baseUrl}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!tokenResponse.ok) throw new Error(await tokenResponse.text());
    const token = await tokenResponse.json();

    const itemsResponse = await fetch(
      `${config.baseUrl}/inventory/v2/tenant/${config.tenantId}/items`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    if (!itemsResponse.ok) throw new Error(await itemsResponse.text());
    const payload = await itemsResponse.json();
    const syncedItems = (payload.data || payload.items || []).map(mapServiceTitanItem);

    memory.items = [...syncedItems, ...memory.items.filter((item) => item.source !== "ServiceTitan")];
    await dataApi("/items/bulk", {
      method: "POST",
      body: JSON.stringify({ items: memory.items }),
    });

    return send(response, 200, {
      configured: true,
      message: `Synced ${syncedItems.length} ServiceTitan items.`,
      items: memory.items,
    });
  } catch (error) {
    return send(response, 500, { error: error.message, items: memory.items });
  }
};
