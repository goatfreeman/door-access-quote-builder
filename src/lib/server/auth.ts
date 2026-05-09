import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/auth-types";

const sessionCookieName = "qqb_session";
const azureStateCookieName = "qqb_azure_state";

export const tempUsers = [
  {
    id: "temp-admin",
    name: "Admin User",
    email: "qqb.admin@example.com",
    password: "QuoteAdmin2026!",
    provider: "password" as const,
    role: "admin" as const,
  },
  {
    id: "temp-tech",
    name: "Tech User",
    email: "qqb.tech@example.com",
    password: "QuoteTech2026!",
    provider: "password" as const,
    role: "user" as const,
  },
];

function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "qqb-dev-only-auth-secret";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload = encodeBase64Url(JSON.stringify({ user, issuedAt: Date.now() }));
  return `${payload}.${signPayload(payload)}`;
}

export function readSessionToken(token?: string): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { user?: SessionUser };
    return parsed.user?.id && parsed.user.name ? parsed.user : null;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) return null;
  return user;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export { azureStateCookieName, sessionCookieName };
