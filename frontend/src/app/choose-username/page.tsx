"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PawIcon from "@/components/ui/PawIcon";
import { chooseUsername, getCurrentProfile } from "@/lib/profiles";

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
          router.replace("/profile");
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
      router.replace("/profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your username.");
      setSaving(false);
    }
  }

  return (
    <section className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center justify-center">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <PawIcon
          variant="background"
          className="absolute left-0 top-1/2 size-[103.5dvh] -translate-x-[40%] -translate-y-1/2 text-primary/20"
        />
      </div>

      <div className="relative w-full rounded-[1.75rem] border border-border bg-card px-6 py-8 shadow-[0_24px_70px_-42px_rgba(80,18,20,0.55)] sm:px-10">
        <h1 className="font-serif text-3xl font-bold text-primary">Enter your username</h1>
        <p className="mt-3 text-sm font-semibold text-foreground">Reminder: Your username is permanent. It cannot be changed later.</p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

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
              {saving ? "Saving…" : "Continue to profile"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
