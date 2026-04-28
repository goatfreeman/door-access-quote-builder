const seedItems = [
  {
    id: "axis-p3265",
    sourceId: "local-axis-p3265",
    name: "Axis P3265-LVE Dome Camera",
    category: "Cameras",
    description: "Outdoor-ready network dome camera for entry and lobby coverage.",
    unitPrice: 879,
    inventory: 0,
    source: "Local",
    lastSyncedAt: null,
  },
  {
    id: "axis-m3085",
    sourceId: "local-axis-m3085",
    name: "Axis M3085-V Compact Dome",
    category: "Cameras",
    description: "Low-profile indoor camera for vestibules, corridors, and reception.",
    unitPrice: 479,
    inventory: 0,
    source: "Local",
    lastSyncedAt: null,
  },
  {
    id: "honeywell-netaxs",
    sourceId: "local-honeywell-netaxs",
    name: "Honeywell NetAXS-123 Panel",
    category: "Access Panels",
    description: "Door access controller with enclosure and power supply allowance.",
    unitPrice: 1295,
    inventory: 0,
    source: "Local",
    lastSyncedAt: null,
  },
  {
    id: "honeywell-reader",
    sourceId: "local-honeywell-reader",
    name: "Honeywell Proximity Reader",
    category: "Access Panels",
    description: "Wall-mounted card reader for single controlled opening.",
    unitPrice: 245,
    inventory: 0,
    source: "Local",
    lastSyncedAt: null,
  },
  {
    id: "assa-9600",
    sourceId: "local-assa-9600",
    name: "ASSA ABLOY 9600 Electric Strike",
    category: "Door Hardware",
    description: "Heavy-duty electric strike for cylindrical or mortise locksets.",
    unitPrice: 398,
    inventory: 0,
    source: "Local",
    lastSyncedAt: null,
  },
  {
    id: "install-labor",
    sourceId: "local-install-labor",
    name: "Installation Labor",
    category: "Labor",
    description: "Technician labor for mounting, wiring, trim-out, and testing.",
    unitPrice: 115,
    inventory: null,
    source: "Local",
    lastSyncedAt: null,
  },
];

const memory = globalThis.__doorQuoteStore || {
  items: seedItems,
  templates: [],
  quotes: [],
};
globalThis.__doorQuoteStore = memory;

function mode() {
  return process.env.DATA_API_URL ? "database" : "memory";
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function dataApi(path, options = {}) {
  if (!process.env.DATA_API_URL) return null;
  const response = await fetch(`${process.env.DATA_API_URL.replace(/\/$/, "")}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DATA_API_TOKEN || ""}`,
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function list(collection) {
  const remote = await dataApi(`/${collection}`);
  return remote?.[collection] || memory[collection];
}

async function upsert(collection, item) {
  const remote = await dataApi(`/${collection}`, {
    method: "POST",
    body: JSON.stringify(item),
  });
  if (remote) return remote[collection] || [];

  memory[collection] = [item, ...memory[collection].filter((current) => current.id !== item.id)];
  return memory[collection];
}

async function remove(collection, id) {
  const remote = await dataApi(`/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (remote) return remote[collection] || [];

  memory[collection] = memory[collection].filter((current) => current.id !== id);
  return memory[collection];
}

module.exports = {
  dataApi,
  list,
  memory,
  mode,
  remove,
  readBody,
  send,
  upsert,
};
