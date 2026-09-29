import { redirect } from "next/navigation";
import { ValidationWorkspace } from "@/components/validation-workspace";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function ValidationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <ValidationWorkspace />;
}