import { getLoginMethod } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (getLoginMethod(email) === "azure") {
    return Response.json({ method: "azure" });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return Response.json({ method: "password" });
  }

  const { data: profile, error } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (error) {
    return Response.json({ method: "password" });
  }

  return Response.json({ method: profile ? "password" : "azure" });
}
