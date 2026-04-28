const { list, mode, readBody, send, upsert } = require("./_store");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      return send(response, 200, { mode: mode(), templates: await list("templates") });
    }

    if (request.method === "POST") {
      const template = await readBody(request);
      const templates = await upsert("templates", {
        ...template,
        updatedAt: new Date().toISOString(),
      });
      return send(response, 200, { mode: mode(), templates });
    }

    return send(response, 405, { error: "Method not allowed" });
  } catch (error) {
    return send(response, 500, { error: error.message });
  }
};
