import { randomBytes } from "node:crypto";
import { azureStateCookieName } from "@/lib/server/auth";

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const email = requestUrl.searchParams.get("email")?.trim().toLowerCase();
  const tenantId = process.env.AZURE_TENANT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_ID;

  if (!tenantId || !clientId) {
    return Response.redirect(new URL("/login?error=Azure%20SSO%20is%20not%20configured%20yet.", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", `${getBaseUrl(request)}/api/auth/azure/callback`);
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  if (email) authorizeUrl.searchParams.set("login_hint", email);

  const response = Response.redirect(authorizeUrl);
  response.headers.append("Set-Cookie", `${azureStateCookieName}=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
