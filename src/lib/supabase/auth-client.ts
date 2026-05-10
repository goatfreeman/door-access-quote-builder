import { createSupabaseBrowserClient } from "./client";

export function getSupabaseAuthClient() {
  try {
    return createSupabaseBrowserClient();
  } catch {
    return null;
  }
}

export function getAuthRedirectUrl(path = "/auth/callback") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (siteUrl) return `${siteUrl}${path}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
