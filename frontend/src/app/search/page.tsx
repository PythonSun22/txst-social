"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PostCard from "@/components/posts/PostCard";
import PostSearch from "@/components/posts/PostSearch";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profiles";
import { getSupabase } from "@/lib/supabase";
import type { FeedPost } from "@/lib/posts";
import { searchPosts } from "@/lib/search";

/** Post title search (FR-80). The query lives in the URL (`/search?q=`) so results can be shared and reloaded. */
function SearchResults() {
  const q = (useSearchParams().get("q") ?? "").trim();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  // Bumped on every new search, so a slow "Load more" for an old query is discarded.
  const generation = useRef({ value: 0 });
  const paging = useRef(false);
  // Stable identity: PostCard's polling effect depends on it.
  const updateStatus = useCallback((id: string, status: FeedPost["status"], failed: boolean) => {
    setPosts((items) => items.map((post) => post.id === id
      ? { ...post, status, moderation_failed: failed } : post));
  }, []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    const lifecycle = generation.current;
    async function load() {
      controller?.abort(); controller = new AbortController();
      const request = controller;
      lifecycle.value++;
      setPosts([]); setCursor(null); setError("");
      if (!q) { setLoading(false); return; }
      setLoading(true);
      try {
        const [account, page] = await Promise.all([getCurrentProfile(request.signal), searchPosts(q, undefined, request.signal)]);
        if (active && !request.signal.aborted) { setProfile(account); setPosts(page.items); setCursor(page.next_cursor); }
      } catch (cause) {
        if (active && !request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to search.");
      } finally { if (active && !request.signal.aborted) setLoading(false); }
    }
    // Signing in or out changes which pending posts are visible, so search again.
    const { data } = getSupabase().auth.onAuthStateChange(() => {
      queueMicrotask(() => { if (active) void load(); });
    });
    void load();
    return () => { active = false; controller?.abort(); lifecycle.value++; data.subscription.unsubscribe(); };
  }, [q]);

  async function loadMore() {
    if (!cursor || paging.current) return;
    const request = generation.current.value;
    paging.current = true; setMore(true); setError("");
    try {
      const page = await searchPosts(q, cursor);
      if (request === generation.current.value) {
        setPosts((current) => [...current, ...page.items.filter((item) => !current.some((p) => p.id === item.id))]);
        setCursor(page.next_cursor);
      }
    } catch (cause) { if (request === generation.current.value) setError(cause instanceof Error ? cause.message : "Unable to load more results."); }
    finally { paging.current = false; setMore(false); }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-primary">{q ? <>Results for “{q}”</> : "Search"}</h1>
        {q && <span className="text-xs text-muted-foreground">Post titles, newest first</span>}
      </div>
      {/* key resets the uncontrolled input when the URL query changes (e.g. browser back). */}
      <PostSearch key={q} defaultValue={q} />
      {!q && <p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">Type a word from a post title to search.</p>}
      {loading && <p role="status">Searching…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {q && !loading && !error && !posts.length && (<p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">No posts match “{q}”. Search looks at whole words in titles — try a different word.</p>)}
      <div className="space-y-3">
      {posts.map((post) => (<PostCard key={`${profile?.id ?? "guest"}:${post.id}`} post={post} profile={profile} onStatus={updateStatus} onDelete={(id) => setPosts((items) => items.filter((item) => item.id !== id))}
      onLike={(id, value) => setPosts((items) => items.map((item) => item.id === id ? { ...item, ...value } : item))}/>))}</div>
      {cursor && (<button type="button" disabled={more} onClick={() => void loadMore()} className="mt-4 rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-40">{more ? "Loading…" : "Load more"}</button>)}
    </>
  );
}

// useSearchParams needs a Suspense boundary, or `next build` fails on this page.
export default function SearchPage() {
  return <Suspense fallback={<p role="status">Searching…</p>}><SearchResults /></Suspense>;
}
