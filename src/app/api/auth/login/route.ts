import { createSessionToken, sessionCookieName, sessionCookieOptions, tempUsers } from "@/lib/server/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const tempUser = tempUsers.find((user) => user.email.toLowerCase() === email && user.password === password);

  if (!tempUser) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const { password: _password, ...user } = tempUser;
  const response = Response.json({ user });
  response.headers.append("Set-Cookie", `${sessionCookieName}=${createSessionToken(user)}; Path=/; Max-Age=${sessionCookieOptions().maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
