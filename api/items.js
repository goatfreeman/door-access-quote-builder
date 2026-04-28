const { list, mode, readBody, send, upsert } = require("./_store");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      return send(response, 200, { mode: mode(), items: await list("items") });
    }

    if (request.method === "POST") {
      const item = await readBody(request);
      const items = await upsert("items", {
        ...item,
        source: item.source || "Manual override",
        updatedAt: new Date().toISOString(),
      });
      return send(response, 200, { mode: mode(), items });
    }

    return send(response, 405, { error: "Method not allowed" });
  } catch (error) {
    return send(response, 500, { error: error.message });
  }
};
