import { redirect } from "next/navigation";
import { QuickQuoteBuilder } from "@/components/quick-quote-builder";
import { getSessionUser } from "@/lib/server/auth";

export default async function ViewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <QuickQuoteBuilder initialUser={user} />;
}
