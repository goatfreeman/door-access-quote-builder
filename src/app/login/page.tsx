import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/server/auth";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const params = searchParams ? await searchParams : {};
  return <LoginForm error={params.error} />;
}
