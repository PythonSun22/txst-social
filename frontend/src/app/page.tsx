"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { fetchPosts, type FeedPost } from "@/lib/posts";

export default function Home() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const generation = useRef({ value: 0 });
  const paging = useRef(false);

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    const lifecycle = generation.current;
    async function load() {
      controller?.abort(); controller = new AbortController();
      const request = controller;
      lifecycle.value++;
      setPosts([]); setProfile(null); setCursor(null); setLoading(true); setError("");
      try {
        const [account, page] = await Promise.all([getCurrentProfile(request.signal), fetchPosts(undefined, request.signal)]);
        if (active && !request.signal.aborted) { setProfile(account); setPosts(page.items); setCursor(page.next_cursor); }
      } catch (cause) {
        if (active && !request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load posts.");
      } finally { if (active && !request.signal.aborted) setLoading(false); }
    }
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabase().auth.onAuthStateChange(() => {
        queueMicrotask(() => { if (active) void load(); });
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void load();
    } catch (cause) {
      queueMicrotask(() => { if (active) { setError(cause instanceof Error ? cause.message : "Unable to load feed."); setLoading(false); } });
    }
    return () => { active = false; controller?.abort(); lifecycle.value++; unsubscribe?.(); };
  }, [reload]);

  async function loadMore() {
    if (!cursor || paging.current) return;
    const request = generation.current.value;
    paging.current = true; setMore(true); setError("");
    try {
      const page = await fetchPosts(cursor);
      if (request === generation.current.value) {
        setPosts((current) => [...current, ...page.items.filter((item) => !current.some((p) => p.id === item.id))]);
        setCursor(page.next_cursor);
      }
    } catch (cause) { if (request === generation.current.value) setError(cause instanceof Error ? cause.message : "Unable to load more posts."); }
    finally { paging.current = false; setMore(false); }
  }

  return <>
    <div className="mb-3 flex items-center justify-between"><h1 className="font-serif text-xl font-bold text-primary">ForAll</h1><span className="text-xs text-muted-foreground">Newest first</span></div>
    <Link href="/submit" className="mb-4 block rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-primary">+ Create Post</Link>
    {loading && <p role="status">Loading posts…</p>}
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>Reload feed</button></p>}
    {!loading && !error && !posts.length && <p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">No posts to show yet. New posts appear here for their author while awaiting review.</p>}
    <div className="space-y-3">{posts.map((post) => <PostCard key={`${profile?.id ?? 'guest'}:${post.id}`} post={post} profile={profile}
      onDelete={(id) => setPosts((items) => items.filter((item) => item.id !== id))}
      onLike={(id, value) => setPosts((items) => items.map((item) => item.id === id ? { ...item, ...value } : item))} />)}</div>
    {cursor && <button type="button" disabled={more} onClick={() => void loadMore()} className="mt-4 rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-40">{more ? "Loading…" : "Load more"}</button>}
  </>;
}
