import { redirect } from "next/navigation";
import { QuickQuoteBuilder } from "@/components/quick-quote-builder";
import { getSessionUser } from "@/lib/server/auth";

export default async function QuoteViewPage({ params }: { params: Promise<{ view: string; quote: string }> }) {
  const { view } = await params;
  const user = await getSessionUser();
  if (!user && view !== "client") redirect("/login");
  return <QuickQuoteBuilder initialUser={user} />;
}
