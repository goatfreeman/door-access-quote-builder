import { createSupabaseBrowserClient } from "./client";

export function getSupabaseAuthClient() {
  try {
    return createSupabaseBrowserClient();
  } catch {
    return null;
  }
}

export function getAuthRedirectUrl(path = "/auth/callback") {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
