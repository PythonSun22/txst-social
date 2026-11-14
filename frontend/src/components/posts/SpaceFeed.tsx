"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PostCard from "@/components/posts/PostCard";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";
import { getSupabase } from "@/lib/supabase";
import { fetchPosts, type FeedPost } from "@/lib/posts";

interface SpaceFeedProps {
  space: string;
  emptyMessage?: string;
}

/** FR-13/60/66: one space's feed; the page owns its heading and navigation. */
export default function SpaceFeed(props: SpaceFeedProps) {
  // A different space starts with fresh posts, pagination and viewer state.
  return <SpaceFeedContent key={props.space} {...props} />;
}

function SpaceFeedContent({
  space,
  emptyMessage = "No posts to show yet. New posts appear here for their author while awaiting automatic screening.",
}: SpaceFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [reload, setReload] = useState(0);
  const requests = useRef({ generation: 0, page: null as AbortController | null });

  const updateStatus = useCallback((id: string, status: FeedPost["status"], failed: boolean) => {
    setPosts((items) => items.map((post) => post.id === id
      ? { ...post, status, moderation_failed: failed } : post));
  }, []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    const lifecycle = requests.current;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      lifecycle.generation++;
      lifecycle.page?.abort();
      lifecycle.page = null;
      setPosts([]);
      setProfile(null);
      setCursor(null);
      setLoading(true);
      setMore(false);
      setError("");
      setMoreError("");
      try {
        const [account, page] = await Promise.all([
          getCurrentProfile(request.signal),
          fetchPosts(undefined, request.signal, space),
        ]);
        if (active && !request.signal.aborted) {
          setProfile(account);
          setPosts(page.items);
          setCursor(page.next_cursor);
        }
      } catch (cause) {
        if (active && !request.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load posts.");
        }
      } finally {
        if (active && !request.signal.aborted) setLoading(false);
      }
    }

    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabase().auth.onAuthStateChange(() => {
        // Leave the Auth callback before reading the current session.
        queueMicrotask(() => { if (active) void load(); });
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void load();
    } catch (cause) {
      queueMicrotask(() => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load feed.");
          setLoading(false);
        }
      });
    }
    return () => {
      active = false;
      controller?.abort();
      lifecycle.page?.abort();
      lifecycle.page = null;
      lifecycle.generation++;
      unsubscribe?.();
    };
  }, [space, reload]);

  async function loadMore() {
    const lifecycle = requests.current;
    if (!cursor || loading || lifecycle.page) return;
    const generation = lifecycle.generation;
    const request = new AbortController();
    lifecycle.page = request;
    setMore(true);
    setMoreError("");
    try {
      const page = await fetchPosts(cursor, request.signal, space);
      if (!request.signal.aborted && generation === lifecycle.generation) {
        setPosts((current) => [...current, ...page.items.filter((item) => !current.some((post) => post.id === item.id))]);
        setCursor(page.next_cursor);
      }
    } catch (cause) {
      if (!request.signal.aborted && generation === lifecycle.generation) {
        setMoreError(cause instanceof Error ? cause.message : "Unable to load more posts.");
      }
    } finally {
      if (lifecycle.page === request) {
        lifecycle.page = null;
        setMore(false);
      }
    }
  }

  return (
    <>
      {loading && <p role="status">Loading posts…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setReload((value) => value + 1)}>Reload feed</button>
        </p>
      )}
      {!loading && !error && !posts.length && (
        <p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard
            key={`${profile?.id ?? "guest"}:${post.id}`}
            post={post}
            profile={profile}
            onStatus={updateStatus}
            onDelete={(id) => setPosts((items) => items.filter((item) => item.id !== id))}
            onLike={(id, value) => setPosts((items) => items.map((item) => item.id === id ? { ...item, ...value } : item))}
          />
        ))}
      </div>
      {moreError && <p role="alert" className="mt-3 text-sm text-red-700">{moreError}</p>}
      {cursor && (
        <button type="button" disabled={more} onClick={() => void loadMore()}
          className="mt-4 rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-40">
          {more ? "Loading…" : moreError ? "Retry loading more" : "Load more"}
        </button>
      )}
    </>
  );
}
