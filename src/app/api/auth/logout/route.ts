import { clearSessionCookieOptions, sessionCookieName } from "@/lib/server/auth";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${sessionCookieName}=; Path=/; Max-Age=${clearSessionCookieOptions().maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
