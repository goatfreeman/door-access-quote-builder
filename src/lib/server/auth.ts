import type { SessionUser } from "@/lib/auth-types";
import { auth } from "@/auth";
import { getLoginMethod, isAzureSsoEmail, tempUsers } from "@/lib/server/auth-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabaseUser = await getSupabaseSessionUser();
  if (supabaseUser) return supabaseUser;

  const session = await auth();
  if (!session?.user?.id || !session.user.name) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email ?? undefined,
    provider: session.user.provider,
    role: session.user.role,
  };
}

async function getSupabaseSessionUser(): Promise<SessionUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle();
    const provider = user.app_metadata.provider === "azure" || user.app_metadata.provider === "sso" ? "azure" : "password";

    return {
      id: user.id,
      name: profile?.display_name ?? user.user_metadata.name ?? user.email?.split("@")[0] ?? "User",
      email: user.email ?? undefined,
      provider,
      role: profile?.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  return getSessionUser();
}

export { getLoginMethod, isAzureSsoEmail, tempUsers };
