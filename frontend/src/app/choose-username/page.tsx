"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AccountSetupCard from "@/components/auth/AccountSetupCard";
import { chooseUsername, getCurrentProfile, getProfileSetupPath } from "@/lib/profiles";

/** One-time public username choice after email confirmation (FR-02, FR-06). */
export default function ChooseUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const profile = await getCurrentProfile();
        if (!active) return;
        if (!profile) {
          router.replace("/login");
        } else if (profile.username_chosen) {
          router.replace(getProfileSetupPath(profile) ?? "/profile");
        } else {
          setLoading(false);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load your account.");
          setLoading(false);
        }
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(chosen)) {
      setError("Use 3–20 letters, numbers, or underscores.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await chooseUsername(chosen);
      router.replace("/choose-college");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your username.");
      setSaving(false);
    }
  }

  return (
    <AccountSetupCard title="Enter your username"
      description="Reminder: Your username is permanent. It cannot be changed later." error={error}>
        {loading ? (
          <p role="status" className="mt-7 text-sm text-muted-foreground">Loading your account…</p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5">
            <div>
              <label htmlFor="username-choice" className="text-sm font-semibold text-foreground">Username</label>
              <div className="mt-2 flex items-center rounded-xl border border-border bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <span aria-hidden="true" className="pl-4 text-muted-foreground">@</span>
                <input
                  id="username-choice"
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-transparent px-2 py-3 text-sm text-foreground outline-none"
                  maxLength={20}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">3–20 letters, numbers, or underscores.</p>
            </div>
            <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-[#681c20] disabled:opacity-60">
              {saving ? "Saving…" : "Continue to college"}
            </button>
          </form>
        )}
    </AccountSetupCard>
  );
}
