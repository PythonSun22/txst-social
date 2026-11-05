"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";
import { listSpaces, setSpaceFollow, type Space } from "@/lib/spaces";
import { getSupabase } from "@/lib/supabase";

interface SpacesState {
  spaces: Space[];
  profile: CurrentProfile | null;
  loading: boolean;
  error: string;
  busy: string | null;
  reload: () => void;
  follow: (slug: string, following: boolean) => Promise<void>;
}

const SpacesContext = createContext<SpacesState | null>(null);

export function useSpaces() {
  const state = useContext(SpacesContext);
  if (!state) throw new Error("Space components require SpacesProvider.");
  return state;
}

export default function SpacesProvider({ children }: { children: ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    async function load() {
      request?.abort();
      request = new AbortController();
      const current = request;
      mutation.current?.abort();
      mutation.current = null;
      setSpaces([]); setProfile(null); setBusy(null); setError(""); setLoading(true);
      try {
        const [items, account] = await Promise.all([listSpaces(current.signal), getCurrentProfile(current.signal)]);
        if (active && !current.signal.aborted) { setSpaces(items); setProfile(account); }
      } catch (cause) {
        if (active && !current.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load spaces.");
      } finally { if (active && !current.signal.aborted) setLoading(false); }
    }
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabase().auth.onAuthStateChange(() => {
        queueMicrotask(() => { if (active) void load(); });
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void load();
    } catch (cause) {
      queueMicrotask(() => {
        if (active) { setError(cause instanceof Error ? cause.message : "Spaces are unavailable."); setLoading(false); }
      });
    }
    return () => { active = false; request?.abort(); mutation.current?.abort(); mutation.current = null; unsubscribe?.(); };
  }, [revision]);

  async function follow(slug: string, following: boolean) {
    if (mutation.current || !profile?.email_verified) return;
    const request = new AbortController();
    mutation.current = request;
    setBusy(slug); setError("");
    try {
      const result = await setSpaceFollow(slug, following, request.signal);
      if (!request.signal.aborted) {
        setSpaces((items) => items.map((space) => space.slug === slug
          ? { ...space, is_following: result.following, follower_count: result.follower_count } : space));
      }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to update this space.");
    } finally {
      if (mutation.current === request) { mutation.current = null; setBusy(null); }
    }
  }

  return <SpacesContext.Provider value={{ spaces, profile, loading, error, busy, follow, reload: () => setRevision((value) => value + 1) }}>
    {children}
  </SpacesContext.Provider>;
}
