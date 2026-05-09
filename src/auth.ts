import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { tempUsers } from "@/lib/server/auth-config";

const microsoftClientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID || process.env.AZURE_CLIENT_ID;
const microsoftClientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || process.env.AZURE_CLIENT_SECRET;
const microsoftTenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID || process.env.AZURE_TENANT_ID;
const microsoftIssuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || (microsoftTenantId ? `https://login.microsoftonline.com/${microsoftTenantId}/v2.0/` : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const tempUser = tempUsers.find((user) => user.email.toLowerCase() === email && user.password === password);
        if (!tempUser) return null;
        const { password: _password, ...user } = tempUser;
        return user;
      },
    }),
    ...(microsoftClientId && microsoftClientSecret
      ? [
          MicrosoftEntraID({
            clientId: microsoftClientId,
            clientSecret: microsoftClientSecret,
            issuer: microsoftIssuer,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user, account, profile }) {
      if (user) {
        const authUser = user as typeof user & { role?: "admin" | "user"; provider?: "password" | "azure" };
        token.id = authUser.id;
        token.role = authUser.role ?? "user";
        token.provider = authUser.provider ?? (account?.provider === "microsoft-entra-id" ? "azure" : "password");
      }

      if (account?.provider === "microsoft-entra-id") {
        const entraProfile = profile as Record<string, unknown> | undefined;
        token.id = String(entraProfile?.oid ?? entraProfile?.sub ?? token.sub ?? token.email ?? "azure-user");
        token.role = "user";
        token.provider = "azure";
      }

      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.id ?? token.sub ?? token.email ?? "user"),
        name: session.user?.name ?? "User",
        email: session.user?.email ?? undefined,
        role: token.role === "admin" ? "admin" : "user",
        provider: token.provider === "azure" ? "azure" : "password",
      };
      return session;
    },
  },
});
