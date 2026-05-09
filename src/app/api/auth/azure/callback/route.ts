import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/auth-types";
import { azureStateCookieName, createSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/server/auth";

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(azureStateCookieName)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.redirect(new URL("/login?error=Azure%20sign-in%20could%20not%20be%20verified.", request.url));
  }

  const tenantId = process.env.AZURE_TENANT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return Response.redirect(new URL("/login?error=Azure%20SSO%20is%20missing%20server%20credentials.", request.url));
  }

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${getBaseUrl(request)}/api/auth/azure/callback`,
      scope: "openid profile email",
    }),
  });

  if (!tokenResponse.ok) {
    return Response.redirect(new URL("/login?error=Azure%20token%20exchange%20failed.", request.url));
  }

  const tokenPayload = (await tokenResponse.json()) as { id_token?: string };
  const profile = tokenPayload.id_token ? decodeJwtPayload(tokenPayload.id_token) : null;
  const email = String(profile?.preferred_username ?? profile?.email ?? "");
  const name = String(profile?.name ?? email || "Azure User");
  const user: SessionUser = {
    id: String(profile?.oid ?? profile?.sub ?? email),
    name,
    email,
    provider: "azure",
    role: "user",
  };

  const response = Response.redirect(new URL("/", request.url));
  response.headers.append("Set-Cookie", `${sessionCookieName}=${createSessionToken(user)}; Path=/; Max-Age=${sessionCookieOptions().maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  response.headers.append("Set-Cookie", `${azureStateCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
