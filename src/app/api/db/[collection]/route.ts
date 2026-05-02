import { isCollection, readCollection, writeCollection } from "@/lib/server/nosql-store";

export async function GET(_request: Request, context: { params: Promise<{ collection: string }> }) {
  const { collection } = await context.params;
  if (!isCollection(collection)) {
    return Response.json({ error: "Unknown collection" }, { status: 404 });
  }

  try {
    return Response.json(await readCollection(collection));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Read failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ collection: string }> }) {
  const { collection } = await context.params;
  if (!isCollection(collection)) {
    return Response.json({ error: "Unknown collection" }, { status: 404 });
  }

  try {
    await writeCollection(collection, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Write failed" }, { status: 500 });
  }
}
