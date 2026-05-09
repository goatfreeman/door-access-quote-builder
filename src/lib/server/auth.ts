import type { SessionUser } from "@/lib/auth-types";
import { auth } from "@/auth";
import { getLoginMethod, isAzureSsoEmail, tempUsers } from "@/lib/server/auth-config";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.name) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email ?? undefined,
    provider: session.user.provider,
    role: session.user.role,
  };
}

export async function requireSessionUser() {
  return getSessionUser();
}

export { getLoginMethod, isAzureSsoEmail, tempUsers };
