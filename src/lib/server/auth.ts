import type { SessionUser } from "@/lib/auth-types";
import { getLoginMethod, isAzureSsoEmail } from "@/lib/server/auth-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseProfile = {
  display_name: string | null;
  role: "admin" | "user" | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  return getSupabaseSessionUser();
}

async function getSupabaseSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseAuthEnabled()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const { data: rawProfile } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle();
    const profile = rawProfile as SupabaseProfile | null;
    const provider = user.app_metadata.provider === "azure" || user.app_metadata.provider === "sso" ? "azure" : "password";
    const metadataName = typeof user.user_metadata.name === "string" ? user.user_metadata.name : undefined;

    return {
      id: user.id,
      name: profile?.display_name ?? metadataName ?? user.email?.split("@")[0] ?? "User",
      email: user.email ?? undefined,
      provider,
      role: profile?.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

function isSupabaseAuthEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function requireSessionUser() {
  return getSessionUser();
}

export { getLoginMethod, isAzureSsoEmail };
