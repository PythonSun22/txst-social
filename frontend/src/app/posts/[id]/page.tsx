"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CommentThread from "@/components/CommentThread";
import PostCard from "@/components/PostCard";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { fetchPost, type FeedPost } from "@/lib/posts";

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;
  const [post, setPost] = useState<FeedPost | null>(null);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort(); controller = new AbortController();
      const request = controller;
      setLoading(true); setError("");
      try {
        const [account, item] = await Promise.all([
          getCurrentProfile(request.signal),
          fetchPost(postId, request.signal),
        ]);
        if (active && !request.signal.aborted) { setProfile(account); setPost(item); }
      } catch (cause) {
        if (active && !request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load post.");
      } finally {
        if (active && !request.signal.aborted) setLoading(false);
      }
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
        if (active) { setError(cause instanceof Error ? cause.message : "Unable to load post."); setLoading(false); }
      });
    }
    return () => { active = false; controller?.abort(); unsubscribe?.(); };
  }, [postId]);

  return (
    <>
      <Link href="/" className="mb-4 inline-block text-sm text-primary underline">← Back to ForAll</Link>
      {loading && <p role="status">Loading post…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {post && <>
        <PostCard post={post} profile={profile}
          onDelete={() => router.push("/")}
          onLike={(id, value) => setPost((current) => current && current.id === id ? { ...current, ...value } : current)}
        />
        <div className="mt-4 rounded-card border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">Comments</h2>
          <CommentThread postId={post.id} profile={profile} />
        </div>
      </>}
    </>
  );
}
