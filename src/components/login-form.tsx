"use client";

import { useState } from "react";
import { KeyRound, Lock, Mail } from "lucide-react";
import { writeDebugLog } from "@/lib/debug-log";
import { getAuthRedirectUrl, getSupabaseAuthClient } from "@/lib/supabase/auth-client";

const deviceIdStorageKey = "qqb.device.id.v1";
const sessionStorageKey = "qqb.cache.sessions.v1";

export function LoginForm({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"email" | "password">("email");
  const [message, setMessage] = useState(error ?? "");
  const [loading, setLoading] = useState(false);

  const continueWithEmail = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as { method?: "password" | "azure"; error?: string } | null;

      if (!response.ok) {
        setMessage(body?.error ?? "Enter a valid email address.");
        return;
      }

      if (body?.method === "azure") {
        window.localStorage.removeItem(deviceIdStorageKey);
        window.localStorage.removeItem(sessionStorageKey);
        await writeDebugLog({
          type: "auth",
          level: "info",
          message: "Microsoft sign-in started; local device session cache cleared.",
          metadata: { email },
        });
        const supabase = getSupabaseAuthClient();
        if (supabase) {
          const { error: supabaseError } = await supabase.auth.signInWithOAuth({
            provider: "azure",
            options: {
              redirectTo: getAuthRedirectUrl(),
              scopes: "email",
              queryParams: { login_hint: email },
            },
          });
          if (!supabaseError) return;
          setMessage("Microsoft sign-in could not be started.");
          return;
        }
        setMessage("Supabase Auth is not configured for Microsoft sign-in.");
        return;
      }

      setMode("password");
    } catch {
      setMessage("Sign-in service is not responding. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async () => {
    setLoading(true);
    setMessage("");
    try {
      window.localStorage.removeItem(deviceIdStorageKey);
      window.localStorage.removeItem(sessionStorageKey);
      await writeDebugLog({
        type: "auth",
        level: "info",
        message: "Supabase password sign-in started; local device session cache cleared.",
        metadata: { email },
      });
      const supabase = getSupabaseAuthClient();
      if (!supabase) {
        setMessage("Supabase Auth is not configured.");
        return;
      }
      const { error: supabaseError } = await supabase.auth.signInWithPassword({ email, password });
      if (!supabaseError) {
        await writeDebugLog({
          type: "auth",
          level: "info",
          message: "Supabase password sign-in succeeded.",
          metadata: { email },
        });
        window.location.replace("/");
        return;
      }
      await writeDebugLog({
        type: "auth",
        level: "warning",
        message: "Supabase password sign-in failed.",
        metadata: { email, error: supabaseError.message },
      });
      setMessage("Invalid email or password.");
    } catch {
      await writeDebugLog({
        type: "auth",
        level: "error",
        message: "Password sign-in request failed.",
        metadata: { email },
      });
      setMessage("Sign-in service is not responding. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage("Enter a valid email address first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      window.localStorage.removeItem(deviceIdStorageKey);
      window.localStorage.removeItem(sessionStorageKey);
      const supabase = getSupabaseAuthClient();
      if (!supabase) {
        setMessage("Supabase Auth is not configured.");
        return;
      }
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/auth/callback?next=/login/confirmed"),
        },
      });
      if (magicLinkError) {
        await writeDebugLog({
          type: "auth",
          level: "warning",
          message: "Supabase magic link sign-in failed.",
          metadata: { email: cleanEmail, error: magicLinkError.message },
        });
        setMessage("Magic link could not be sent.");
        return;
      }
      await writeDebugLog({
        type: "auth",
        level: "info",
        message: "Supabase magic link sent.",
        metadata: { email: cleanEmail },
      });
      setMessage("Magic link sent. Check your email to sign in.");
    } catch {
      await writeDebugLog({
        type: "auth",
        level: "error",
        message: "Magic link request failed.",
        metadata: { email },
      });
      setMessage("Sign-in service is not responding. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-4 text-stone-950">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl">
        <div>
          <div className="grid size-11 place-items-center rounded-lg bg-stone-900 text-xl font-black text-white">Q</div>
          <h1 className="mt-4 text-2xl font-black">Sign in to Quick Quote Builder</h1>
          <p className="mt-2 text-sm text-stone-600">Enter your email first. New SSO users are sent to Microsoft; existing password users can use a password or magic link.</p>
        </div>

        {message ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{message}</p> : null}

        <div className="mt-5 grid gap-3">
          <label className="field">
            <span>Email</span>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-stone-200 bg-white px-3">
              <Mail size={16} className="text-stone-500" />
              <input
                className="min-h-11 min-w-0 bg-transparent text-sm font-bold outline-none"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setMode("email");
                  setMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && mode === "email") void continueWithEmail();
                }}
              />
            </div>
          </label>
          {mode === "password" ? (
            <label className="field">
              <span>Password</span>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-stone-200 bg-white px-3">
                <Lock size={16} className="text-stone-500" />
                <input
                  className="min-h-11 min-w-0 bg-transparent text-sm font-bold outline-none"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitPassword();
                  }}
                />
              </div>
            </label>
          ) : null}
          {mode === "email" ? (
            <div className="grid gap-2">
              <button className="button-primary" onClick={continueWithEmail} disabled={loading}>
                {loading ? "Checking..." : "Continue"}
              </button>
              <button className="button-secondary justify-center" onClick={sendMagicLink} disabled={loading}>
                <KeyRound size={16} />
                Email magic link
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <button className="button-primary" onClick={submitPassword} disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
              <button className="button-secondary justify-center" onClick={sendMagicLink} disabled={loading}>
                <KeyRound size={16} />
                Email magic link instead
              </button>
              <button className="button-ghost justify-center" onClick={() => setMode("email")}>
                Use a different email
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
