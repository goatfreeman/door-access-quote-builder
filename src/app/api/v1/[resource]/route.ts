import { getSessionUser } from "@/lib/server/auth";
import { createResource, isApiResource, listResource } from "@/lib/server/resource-api";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { resource } = await context.params;
  if (!isApiResource(resource)) return Response.json({ error: "Unknown resource" }, { status: 404 });

  try {
    const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
    return Response.json({ data: await listResource(resource, user, includeDeleted) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Read failed" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { resource } = await context.params;
  if (!isApiResource(resource)) return Response.json({ error: "Unknown resource" }, { status: 404 });

  try {
    const record = await createResource(resource, await request.json().catch(() => null), user);
    return Response.json({ data: record }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Create failed" }, { status: 400 });
  }
}
