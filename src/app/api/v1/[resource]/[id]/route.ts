import { getSessionUser } from "@/lib/server/auth";
import { deleteResource, getResource, isApiResource, updateResource } from "@/lib/server/resource-api";

export async function GET(_request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { resource, id } = await context.params;
  if (!isApiResource(resource)) return Response.json({ error: "Unknown resource" }, { status: 404 });

  try {
    const record = await getResource(resource, id, user);
    if (!record) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: record });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Read failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { resource, id } = await context.params;
  if (!isApiResource(resource)) return Response.json({ error: "Unknown resource" }, { status: 404 });

  try {
    const result = await updateResource(resource, id, await request.json().catch(() => null), user);
    if (result === "forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { resource, id } = await context.params;
  if (!isApiResource(resource)) return Response.json({ error: "Unknown resource" }, { status: 404 });

  try {
    const result = await deleteResource(resource, id, user);
    if (result === "forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ data: result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
