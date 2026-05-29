import type { SessionUser } from "@/lib/auth-types";
import { getLoginMethod, isAzureSsoEmail } from "@/lib/server/auth-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseProfile = {
  display_name: string | null;
  role: "admin" | "user" | null;
};

function metadataText(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

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
    const metadataName = metadataText(user.user_metadata, ["name", "full_name", "display_name", "preferred_username"]);
    const emailName = user.email?.split("@")[0] ?? "User";
    const profileName = profile?.display_name?.trim();
    const displayName = profileName && profileName !== emailName ? profileName : metadataName ?? profileName ?? emailName;

    return {
      id: user.id,
      name: displayName,
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
