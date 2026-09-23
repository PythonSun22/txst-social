"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AuthError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";

type Mode = "signin" | "signup";

function describeAuthError(cause: unknown, mode: Mode): string {
  if (cause instanceof AuthError) {
    if (cause.code === "over_email_send_rate_limit") {
      return "Too many attempts right now — please wait a few minutes and try again.";
    }
    // The DB's txstate.edu-only trigger (FR-01) rejects the insert with its
    // own message, but Supabase's Auth API wraps any DB error at signup into
    // this generic, unhelpful text rather than passing the real one through.
    // We catch the txstate.edu case earlier, client-side, so this is the
    // fallback for anything else that hits it.
    if (cause.status === 500) {
      return "Something went wrong creating your account. Please try again.";
    }
    return cause.message;
  }
  if (cause instanceof Error) return cause.message;
  return mode === "signup" ? "Sign-up failed." : "Sign-in failed.";
}

export default function AuthForm() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const current = await getCurrentProfile(controller.signal);
        if (active && !controller.signal.aborted) { setProfile(current); setError(""); }
      } catch (cause) {
        if (active && !controller.signal.aborted) {
          setProfile(null);
          setError(cause instanceof Error ? cause.message : "Unable to load your account.");
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    }
    try {
      const { data } = getSupabase().auth.onAuthStateChange(() => {
        // Leave the Auth callback before asking the SDK for the current session.
        queueMicrotask(() => { if (active) void refresh(); });
      });
      void refresh();
      return () => { active = false; request?.abort(); data.subscription.unsubscribe(); };
    } catch (cause) {
      queueMicrotask(() => {
        if (active) { setError(cause instanceof Error ? cause.message : "Sign-in is unavailable."); setLoading(false); }
      });
      return () => { active = false; };
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        const trimmedEmail = email.trim();
        // FR-01 is enforced for real by a DB trigger, but Supabase's Auth API
        // wraps the trigger's rejection into a generic "Database error saving
        // new user" message instead of passing it through (confirmed against
        // the real project) — so we check client-side first for a message
        // that's actually useful.
        if (!trimmedEmail.toLowerCase().endsWith("@txstate.edu")) {
          setError("Boko Lynx is limited to Texas State (txstate.edu) email addresses.");
          setBusy(false);
          return;
        }
        const { data, error } = await getSupabase().auth.signUp({ email: trimmedEmail, password });
        if (error) throw error;
        // Supabase returns 200 with an empty identities array instead of an
        // error when the email is already registered, to avoid leaking which
        // addresses exist.
        if (data.user && data.user.identities?.length === 0) {
          setError("An account with this email may already exist. Try signing in, or check your inbox if you haven't confirmed it yet.");
        } else {
          setMessage("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      setPassword("");
    } catch (cause) {
      setError(describeAuthError(cause, mode));
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError("");
    try {
      const { error } = await getSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      setProfile(null); setMessage("Signed out.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed.");
    } finally { setBusy(false); }
  }

  return <div className="max-w-md space-y-4 py-4">
    {loading && <p role="status">Loading account…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {profile ? <>
      <p>Signed in as {profile.display_name || profile.username}.</p>
      <p>{profile.email_verified ? "Your Texas State email is verified." : "Verify your Texas State email before posting."}</p>
    </> : !loading && <form onSubmit={submit} className="space-y-4">
      <p>
        {mode === "signup"
          ? "Create an account with your Texas State email."
          : "Sign in with your existing Texas State account."}
      </p>
      <label className="block">Texas State email
        <input className="block w-full rounded border p-2" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <label className="block">Password
        <input className="block w-full rounded border p-2" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <button className="rounded border px-4 py-2" disabled={busy} type="submit">
        {busy ? "Please wait…" : mode === "signup" ? "Sign up" : "Sign in"}
      </button>
      <button
        className="block text-sm underline"
        type="button"
        disabled={busy}
        onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setMessage(""); }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
      </button>
    </form>}
    {!loading && <button className="rounded border px-4 py-2" disabled={busy} onClick={signOut}>Sign out</button>}
  </div>;
}
