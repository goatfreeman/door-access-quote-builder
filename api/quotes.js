const { list, mode, readBody, remove, send, upsert } = require("./_store");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      return send(response, 200, { mode: mode(), quotes: await list("quotes") });
    }

    if (request.method === "POST") {
      const quote = await readBody(request);
      const quotes = await upsert("quotes", {
        ...quote,
        updatedAt: new Date().toISOString(),
      });
      return send(response, 200, { mode: mode(), quotes });
    }

    if (request.method === "DELETE") {
      const { id } = await readBody(request);
      if (!id) return send(response, 400, { error: "Quote id is required" });
      const quotes = await remove("quotes", id);
      return send(response, 200, { mode: mode(), quotes });
    }

    return send(response, 405, { error: "Method not allowed" });
  } catch (error) {
    return send(response, 500, { error: error.message });
  }
};
