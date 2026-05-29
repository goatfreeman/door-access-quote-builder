import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getSessionUser } from "@/lib/server/auth";

export default async function LoginConfirmedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-4 text-stone-950">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 text-center shadow-xl">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-teal-100 text-teal-800">
          <CheckCircle2 size={24} />
        </div>
        <h1 className="mt-4 text-2xl font-black">Sign-in confirmed</h1>
        <p className="mt-2 text-sm text-stone-600">Your session is active. Return to Quick Quote Builder to continue.</p>
        <Link className="button-primary mt-5 w-full" href="/">
          Return to app
        </Link>
      </section>
    </main>
  );
}
