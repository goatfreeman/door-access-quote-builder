"use client";

import { useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { writeDebugLog } from "@/lib/debug-log";
import { getSupabaseAuthClient } from "@/lib/supabase/auth-client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    setMessage("");
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseAuthClient();
      if (!supabase) {
        setMessage("Supabase Auth is not configured.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        await writeDebugLog({
          type: "auth",
          level: "warning",
          message: "Supabase password reset update failed.",
          metadata: { error: error.message },
        });
        setMessage("Password could not be updated.");
        return;
      }
      await writeDebugLog({
        type: "auth",
        level: "info",
        message: "Supabase password reset completed.",
      });
      window.location.replace("/");
    } catch {
      await writeDebugLog({
        type: "auth",
        level: "error",
        message: "Password reset update request failed.",
      });
      setMessage("Password reset service is not responding. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-4 text-stone-950">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl">
        <div className="grid size-11 place-items-center rounded-lg bg-stone-900 text-white">
          <KeyRound size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-black">Set a new password</h1>
        <p className="mt-2 text-sm text-stone-600">Enter a new password for this account. After it is saved, you will return to Quick Quote Builder.</p>
        {message ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{message}</p> : null}
        <div className="mt-5 grid gap-3">
          <label className="field">
            <span>New password</span>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-stone-200 bg-white px-3">
              <Lock size={16} className="text-stone-500" />
              <input className="min-h-11 min-w-0 bg-transparent text-sm font-bold outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </label>
          <label className="field">
            <span>Confirm password</span>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-stone-200 bg-white px-3">
              <Lock size={16} className="text-stone-500" />
              <input
                className="min-h-11 min-w-0 bg-transparent text-sm font-bold outline-none"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void updatePassword();
                }}
              />
            </div>
          </label>
          <button className="button-primary" onClick={updatePassword} disabled={loading}>
            {loading ? "Saving..." : "Save new password"}
          </button>
        </div>
      </section>
    </main>
  );
}
