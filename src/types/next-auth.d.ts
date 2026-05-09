import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      provider?: "password" | "azure";
      role?: "admin" | "user";
    } & DefaultSession["user"];
  }

  interface User {
    provider?: "password" | "azure";
    role?: "admin" | "user";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    provider?: "password" | "azure";
    role?: "admin" | "user";
  }
}
