"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";

export default function AuthForm() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
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
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
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
      <p>Sign in with your existing Texas State account.</p>
      <label className="block">Texas State email
        <input className="block w-full rounded border p-2" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <label className="block">Password
        <input className="block w-full rounded border p-2" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <button className="rounded border px-4 py-2" disabled={busy} type="submit">{busy ? "Please wait…" : "Sign in"}</button>
    </form>}
    {!loading && <button className="rounded border px-4 py-2" disabled={busy} onClick={signOut}>Sign out</button>}
  </div>;
}
