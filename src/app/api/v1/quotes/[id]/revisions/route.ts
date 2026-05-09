import { getSessionUser } from "@/lib/server/auth";
import { getResource } from "@/lib/server/resource-api";
import type { SavedQuote } from "@/lib/types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const quote = (await getResource("quotes", id, user)) as SavedQuote | null;
    if (!quote) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({
      data: {
        quoteId: quote.id,
        current: {
          id: `${quote.id}-current`,
          savedAt: quote.updatedAt,
          meta: quote.meta,
          lines: quote.lines,
          total: quote.total,
          editedBy: quote.updatedBy,
          editedByName: quote.updatedByName,
        },
        revisions: quote.revisions ?? [],
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Read failed" }, { status: 500 });
  }
}
