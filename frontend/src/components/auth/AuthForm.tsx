"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { AuthError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";
import { useRouter } from "next/navigation";
import styles from "./AuthForm.module.css";

type Mode = "signin" | "signup" | "confirm";

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
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const current = await getCurrentProfile(controller.signal);
        if (active && !controller.signal.aborted) {
          setProfile(current);
          setError("");
          if (current) router.replace("/");
        }
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
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const trimmedEmail = email.trim();
      // FR-01: explain the email restriction before calling Auth; the server
      // and database remain responsible for enforcing it.
      if (mode !== "confirm" && !trimmedEmail.toLowerCase().endsWith("@txstate.edu")) {
        setError("Please use your Texas State (@txstate.edu) email address.");
        return;
      }
      if (mode === "signup") {
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
          setMessage("Enter the confirmation code we emailed you.");
          setMode("confirm");
        }
      } else if (mode === "confirm") {
        const { error } = await getSupabase().auth.verifyOtp({
          email: pendingEmail,
          token: code.trim(),
          type: "email",
        });
        if (error) throw error;
        setCode("");
        setPendingEmail("");
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({ email: trimmedEmail, password });
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

  return <div className={styles.auth}>
    {loading && <p className={styles.notice} role="status">Loading account…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}
    {profile ? <div className={styles.account}>
      <p>Signed in as {profile.display_name || profile.username}.</p>
      <p>{profile.email_verified ? "Your Texas State email is verified." : "Verify your Texas State email before posting."}</p>
      <button className={styles.primaryButton} type="button" disabled={busy} onClick={signOut}>Sign out</button>
    </div> : mode === "confirm" ? <form onSubmit={submit} className={styles.form} aria-label="Confirm your email">
      <div className={styles.confirmation}>
      <p>Enter the code we emailed to {pendingEmail}.</p>
      <p className={styles.hint}>
        Don&apos;t see it? Check your Junk/Spam folder — Texas State&apos;s mail
        filter sometimes routes it there.
      </p>
      </div>
      <label>
        <span className="sr-only">Confirmation code</span>
        <input className={`${styles.input} ${styles.codeInput}`} placeholder="Confirmation code" type="text" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} />
      </label>
      <button className={styles.primaryButton} disabled={busy} type="submit">
        {busy ? "Please wait…" : "Confirm"}
      </button>
      <button
        className={styles.textButton}
        type="button"
        disabled={busy}
        onClick={() => { setMode("signup"); setShowPassword(false); setCode(""); setPendingEmail(""); setError(""); setMessage(""); }}
      >
        Start over
      </button>
    </form> : !loading && <>
      <form onSubmit={submit} className={styles.form} aria-label={mode === "signup" ? "Create your account" : "Log in"}>
      <p className="sr-only">
        {mode === "signup"
          ? "Create an account with your Texas State email."
          : "Sign in with your existing Texas State account."}
      </p>
      <div className={styles.field}>
        <Mail className={styles.fieldIcon} strokeWidth={1.8} aria-hidden="true" />
        <input className={styles.input} aria-label="Texas State email" placeholder="TXST Email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
      </div>
      <div className={styles.field}>
        <LockKeyhole className={styles.fieldIcon} strokeWidth={1.8} aria-hidden="true" />
        <input id="auth-password" className={`${styles.input} ${styles.passwordInput}`} aria-label="Password" placeholder="Password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={event => setPassword(event.target.value)} />
        <button className={styles.visibilityButton} type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
        </button>
      </div>
      {mode === "signup" && <p className={styles.hint}>Use your @txstate.edu email and a password with at least 6 characters.</p>}
      <button className={styles.primaryButton} disabled={busy} type="submit">
        {busy ? "Please wait…" : mode === "signup" ? "Sign up" : "Log In"}
        {!busy && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>}
      </button>
      </form>
      <div className={styles.footer}>
      {mode === "signup" && <span>Already have an account?</span>}
      <button
        className={styles.textButton}
        type="button"
        disabled={busy}
        onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setShowPassword(false); setError(""); setMessage(""); }}
      >
        {mode === "signup" ? "Log in" : "Sign up"}
      </button>
      </div>
    </>}
  </div>;
}
