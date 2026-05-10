import { redirect } from "next/navigation";
import { QuickQuoteBuilder } from "@/components/quick-quote-builder";
import { getSessionUser } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams?: Promise<{ code?: string }> }) {
  const params = searchParams ? await searchParams : {};
  if (params.code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(params.code);
    redirect("/");
  }

  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <QuickQuoteBuilder initialUser={user} />;
}
