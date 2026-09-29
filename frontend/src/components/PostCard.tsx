"use client";
/* eslint-disable @next/next/no-img-element -- Expiring, authorized Storage URLs are fetched directly. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PawIcon from "./PawIcon";
import { deletePost, getPostImage, setPostLike, type FeedPost } from "@/lib/posts";
import type { CurrentProfile } from "@/lib/api";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function PostImage({ postId, media }: { postId: string; media: FeedPost["media"][number] }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getPostImage(postId, media.position, controller.signal).then((result) => {
      if (!controller.signal.aborted) setUrl(result.url);
    }).catch(() => { if (!controller.signal.aborted) setError("Image unavailable."); });
    return () => controller.abort();
  }, [postId, media.position, retry]);
  return <div>
    {url && !error && <img src={url} alt={`Post image ${media.position + 1}`} width={media.width ?? undefined} height={media.height ?? undefined}
      className="mx-auto max-h-[36rem] w-auto max-w-full rounded-card object-contain" onError={() => setError("Image preview expired or unavailable.")} />}
    {!url && !error && <p role="status" className="text-sm text-muted-foreground">Loading image…</p>}
    {error && <p className="text-sm">{error} <button type="button" className="underline" onClick={() => { setError(""); setUrl(""); setRetry((n) => n + 1); }}>Retry image</button></p>}
  </div>;
}

export default function PostCard({ post, profile, onLike, onDelete }: {
  post: FeedPost; profile: CurrentProfile | null;
  onLike: (id: string, value: { liked: boolean; like_count: number }) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const canLike = !!profile?.email_verified && (post.status === "pending" || post.status === "approved");
  const canDelete = !!profile?.email_verified && post.can_delete;
  async function remove() {
    if (!canDelete || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await deletePost(post.id);
      if (mounted.current) onDelete(post.id);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to delete post.");
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function toggle() {
    if (!canLike || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await setPostLike(post.id, !post.liked);
      // Account changes remount cards; don't apply the previous viewer's response.
      if (mounted.current) onLike(post.id, result);
    }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to update like."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <article className="rounded-card border border-border bg-card p-4">
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <PawIcon size={16} /><strong className="text-primary">General</strong>
      <span>Posted by {post.author}</span><time dateTime={post.created_at}>{dateFormat.format(new Date(post.created_at))}</time>
      {post.status !== "approved" && <span className="rounded-full bg-accent/10 px-2 py-1 font-semibold text-primary">{post.status === "pending" ? "Pending review · Only you" : post.status}</span>}
    </div>
    <h2 className="mb-2 break-words text-base font-semibold">{post.title}</h2>
    {post.body && <p className="mb-3 whitespace-pre-wrap break-words text-sm">{post.body}</p>}
    {post.url && /^https?:\/\//i.test(post.url) && <a href={post.url} target="_blank" rel="noopener noreferrer" className="mb-3 block break-all text-sm text-primary underline">{post.url}</a>}
    <div className="space-y-3">{post.media.map((media) => <PostImage key={media.position} postId={post.id} media={media} />)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      <button type="button" onClick={() => void toggle()} disabled={!canLike || busy} aria-pressed={post.liked}
        aria-label={post.liked ? "Unlike post" : "Like post"}
        className={`rounded-full bg-muted px-3 py-2 font-bold disabled:opacity-50 ${post.liked ? "text-primary" : "text-muted-foreground"}`}>
        ▲ {post.like_count} {post.liked ? "Liked" : "Like"}
      </button>
      <span className="text-muted-foreground">{post.comment_count} comments</span>
      {canDelete && !confirmDelete && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}
        className="ml-auto rounded-full px-3 py-2 text-red-700 disabled:opacity-50">Delete post</button>}
      {!profile && <Link href="/login" className="text-primary underline">Sign in to like</Link>}
      {profile && !profile.email_verified && <span>Verify your email to like posts.</span>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {canDelete && confirmDelete && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" role="group" aria-label="Confirm post deletion">
      <p>Delete this post?</p>
      <button type="button" disabled={busy} onClick={() => void remove()}
        className="rounded-full bg-red-700 px-3 py-2 text-white disabled:opacity-50">{busy ? "Deleting…" : "Confirm delete"}</button>
      <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="rounded-full border border-border px-3 py-2 disabled:opacity-50">Cancel</button>
    </div>}
  </article>;
}
