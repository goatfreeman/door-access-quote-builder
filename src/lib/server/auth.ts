import type { SessionUser } from "@/lib/auth-types";
import { getLoginMethod, isAzureSsoEmail } from "@/lib/server/auth-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseProfile = {
  display_name: string | null;
  role: "admin" | "user" | null;
};

type SupabaseIdentity = {
  provider?: string | null;
  identity_data?: Record<string, unknown> | null;
};

function metadataText(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function metadataName(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return undefined;
  const fullName = metadataText(metadata, ["name", "full_name", "display_name", "preferred_username"]);
  if (fullName) return fullName;

  const givenName = metadataText(metadata, ["given_name", "first_name"]);
  const familyName = metadataText(metadata, ["family_name", "last_name", "surname"]);
  const joined = [givenName, familyName].filter(Boolean).join(" ").trim();
  return joined || undefined;
}

function metadataList(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
  if (typeof value === "string") return [value.toLowerCase()];
  return [];
}

function userAuthProvider(user: { app_metadata: Record<string, unknown>; identities?: SupabaseIdentity[] | null; email?: string }) {
  const providers = new Set<string>([
    metadataText(user.app_metadata, ["provider"])?.toLowerCase() ?? "",
    ...metadataList(user.app_metadata, "providers"),
    ...(user.identities ?? []).map((identity) => identity.provider?.toLowerCase() ?? ""),
  ]);
  if (providers.has("azure") || providers.has("sso")) return "azure";
  if (user.email && isAzureSsoEmail(user.email)) return "azure";
  return "password";
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
    const provider = userAuthProvider(user);
    const profileName = profile?.display_name?.trim();
    const displayName = preferredUserName(user, profileName);

    if (profileName !== displayName) {
      await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    }

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

function isEmailFallbackName(name: string | undefined, email: string | undefined) {
  if (!name || !email) return false;
  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedName === normalizedEmail || normalizedName === normalizedEmail.split("@")[0];
}

function preferredUserName(user: { email?: string; user_metadata: Record<string, unknown>; identities?: SupabaseIdentity[] | null }, profileName?: string) {
  const emailName = user.email?.split("@")[0] ?? "User";
  const authNames = [metadataName(user.user_metadata), ...(user.identities ?? []).map((identity) => metadataName(identity.identity_data))].filter(
    (name): name is string => Boolean(name)
  );
  const authName = authNames.find((name) => !isEmailFallbackName(name, user.email)) ?? authNames[0];

  if (profileName && !isEmailFallbackName(profileName, user.email)) return profileName;
  return authName ?? profileName ?? emailName;
}

function isSupabaseAuthEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function requireSessionUser() {
  return getSessionUser();
}

export { getLoginMethod, isAzureSsoEmail };
