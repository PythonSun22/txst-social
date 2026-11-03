"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";

type Mode = "signin" | "signup" | "confirm";

const fieldClassName = "mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10";
const primaryButtonClassName = "flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#681c20] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

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
  if (mode === "signup") return "Sign-up failed.";
  if (mode === "confirm") return "That code didn't work.";
  return "Sign-in failed.";
}

export default function AuthForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (profile) router.replace("/");
  }, [profile, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
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
          // A plain confirmation link can be "clicked" by a mail security
          // scanner (e.g. TXST's Microsoft 365 gateway) before the student
          // ever opens the email, silently confirming accounts nobody asked
          // to confirm. A code the student has to type can't be guessed by a
          // scanner that only fetches URLs, so we use verifyOtp instead of
          // relying on the emailed link.
          setPendingEmail(trimmedEmail);
          setMode("confirm");
        }
      } else if (mode === "confirm") {
        const { error } = await getSupabase().auth.verifyOtp({
          email: pendingEmail,
          token: code.trim(),
          type: "email",
        });
        if (error) throw error;
        const current = await getCurrentProfile();
        if (!current) throw new Error("Unable to load your account.");
        setProfile(current);
        setCode("");
        setPendingEmail("");
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const current = await getCurrentProfile();
        if (!current) throw new Error("Unable to load your account.");
        setProfile(current);
      }
      setPassword("");
    } catch (cause) {
      setError(describeAuthError(cause, mode));
    } finally { setBusy(false); }
  }

  function switchMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError("");
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-7 sm:px-8 sm:py-8">
      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          {error}
        </p>
      )}
      {loading || profile ? (
        <div role="status" className="flex min-h-44 items-center gap-3 text-sm text-muted-foreground">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          {profile ? "Opening ForAll…" : "Loading your account…"}
        </div>
      ) : mode === "confirm" ? (
        <form onSubmit={submit} className="space-y-6">
          <div>
            <h2 className="font-serif text-2xl font-bold text-primary">Check your inbox</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter the confirmation code we emailed to <span className="break-all font-semibold text-foreground">{pendingEmail}</span>.
            </p>
          </div>
          <div>
            <label htmlFor="auth-code" className="text-sm font-semibold text-foreground">Confirmation code</label>
            <input
              id="auth-code"
              name="code"
              className={fieldClassName}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={event => setCode(event.target.value)}
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Check your Junk or Spam folder if the email has not arrived.
            </p>
          </div>
          <button className={primaryButtonClassName} disabled={busy} type="submit">
            {busy ? "Please wait…" : "Confirm email"}
          </button>
          <button
            className="w-full rounded-lg py-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            type="button"
            disabled={busy}
            onClick={() => { setMode("signup"); setCode(""); setPendingEmail(""); setError(""); }}
          >
            Start over
          </button>
        </form>
      ) : (
        <div>
          <div className="mb-7 grid grid-cols-2 rounded-xl bg-secondary p-1" aria-label="Account action">
            <button
              type="button"
              aria-pressed={mode === "signin"}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${mode === "signin" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}
              disabled={busy}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${mode === "signup" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}
              disabled={busy}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>

          <div className="mb-6">
            <h2 className="font-serif text-2xl font-bold text-primary">
              {mode === "signup" ? "Join TXST Lynx" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === "signup"
                ? "Create an account with your Texas State email."
                : "Sign in with your Texas State account."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="auth-email" className="text-sm font-semibold text-foreground">Texas State email</label>
              <input
                id="auth-email"
                name="email"
                className={fieldClassName}
                type="email"
                placeholder="name@txstate.edu"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="text-sm font-semibold text-foreground">Password</label>
              <input
                id="auth-password"
                name="password"
                className={fieldClassName}
                type="password"
                placeholder="Enter your password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              {mode === "signup" && <p className="mt-2 text-xs text-muted-foreground">Use at least 6 characters.</p>}
            </div>
            <button className={primaryButtonClassName} disabled={busy} type="submit">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to TXST Lynx?"}{" "}
            <button
              className="rounded font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
              type="button"
              disabled={busy}
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
