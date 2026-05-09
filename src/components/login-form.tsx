"use client";

import { useState } from "react";
import { Lock, Mail } from "lucide-react";

const demoUsers = [
  { label: "Admin User", email: "qqb.admin@example.com", password: "QuoteAdmin2026!" },
  { label: "Tech User", email: "qqb.tech@example.com", password: "QuoteTech2026!" },
];

export function LoginForm({ error }: { error?: string }) {
  const [email, setEmail] = useState(demoUsers[0].email);
  const [password, setPassword] = useState(demoUsers[0].password);
  const [mode, setMode] = useState<"email" | "password">("email");
  const [message, setMessage] = useState(error ?? "");
  const [loading, setLoading] = useState(false);

  const continueWithEmail = async () => {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as { method?: "password" | "azure"; error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setMessage(body?.error ?? "Enter a valid email address.");
      return;
    }

    if (body?.method === "azure") {
      window.location.href = `/api/auth/azure/start?email=${encodeURIComponent(email)}`;
      return;
    }

    setMode("password");
  };

  const submitPassword = async () => {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Sign in failed.");
      return;
    }
    window.location.href = "/";
  };

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-4 text-stone-950">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl">
        <div>
          <div className="grid size-11 place-items-center rounded-lg bg-stone-900 text-xl font-black text-white">Q</div>
          <h1 className="mt-4 text-2xl font-black">Sign in to Quick Quote Builder</h1>
          <p className="mt-2 text-sm text-stone-600">Enter your email first. SSO users are sent to Microsoft; other users continue with a password.</p>
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
            <button className="button-primary" onClick={continueWithEmail} disabled={loading}>
              {loading ? "Checking..." : "Continue"}
            </button>
          ) : (
            <div className="grid gap-2">
              <button className="button-primary" onClick={submitPassword} disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
              <button className="button-ghost justify-center" onClick={() => setMode("email")}>
                Use a different email
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs font-black uppercase tracking-normal text-stone-500">Temporary test users</p>
          {demoUsers.map((user) => (
            <button
              key={user.email}
              className="rounded-md bg-white p-2 text-left text-sm hover:bg-teal-50"
              onClick={() => {
                setEmail(user.email);
                setPassword(user.password);
                setMode("password");
                setMessage("");
              }}
            >
              <strong>{user.label}</strong>
              <span className="block text-stone-600">{user.email}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
