import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getSessionUser } from "@/lib/server/auth";

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ResetPasswordForm />;
}
