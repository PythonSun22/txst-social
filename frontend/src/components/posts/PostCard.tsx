"use client";
/* eslint-disable @next/next/no-img-element -- Expiring, authorized Storage URLs are fetched directly. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PawIcon from "@/components/ui/PawIcon";
import ImageViewer from "@/components/images/ImageViewer";
import { apiRequest } from "@/lib/api";
import { fetchPost, deletePost, getPostImage, setPostLike, retryPostScreening, type FeedPost } from "@/lib/posts";
import type { CurrentProfile } from "@/lib/profiles";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function AuthorAvatar({ id }: { id: string }) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ url: string }>(`/images/${id}/published-preview?variant=avatar_small`, { signal: controller.signal }, true)
      .then(({ url }) => { if (!controller.signal.aborted) setImage({ id, url }); }).catch(() => {});
    return () => controller.abort();
  }, [id]);
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center">
    {image?.id === id ? <img src={image.url} alt="" width={48} height={48} loading="lazy" className="h-full w-full rounded-full object-cover" /> : <PawIcon size={24} />}
  </span>;
}

function PostImage({ postId, media, status, onOpen }: { postId: string; media: FeedPost["media"][number]; status: string; onOpen: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    getPostImage(postId, media.position, controller.signal).then((result) => {
      if (!controller.signal.aborted) { setUrl(result.url); setError(""); }
    }).catch(() => { if (!controller.signal.aborted) {
      setError(status === "pending" ? "Image processing is pending." : "Image unavailable.");
      if (status === "pending") timer = setTimeout(() => setRetry(n => n + 1), 5000);
    } });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [postId, media.position, retry, status]);
  return <div>
    {url && !error && <button type="button" onClick={onOpen} aria-label={`Open image ${media.position + 1}`} className="block w-full rounded-card focus-visible:outline-2 focus-visible:outline-primary">
      <img src={url} loading="lazy" alt={`Post image ${media.position + 1}`} width={media.width ?? undefined} height={media.height ?? undefined}
      className="mx-auto max-h-96 w-auto max-w-full rounded-card object-contain" onError={() => setError("Image is processing, expired or unavailable.")} />
    </button>}
    {!url && !error && <p role="status" className="text-sm text-muted-foreground">Loading image…</p>}
    {error && <p className="text-sm">{error} <button type="button" className="underline" onClick={() => { setError(""); setUrl(""); setRetry((n) => n + 1); }}>Retry image</button></p>}
  </div>;
}

export default function PostCard({ post, profile, onLike, onDelete, onStatus }: {
  post: FeedPost; profile: CurrentProfile | null;
  onLike: (id: string, value: { liked: boolean; like_count: number }) => void;
  onDelete: (id: string) => void;
  onStatus?: (id: string, status: FeedPost["status"], failed: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [screening, setScreening] = useState<FeedPost | null>(null);
  const screeningView = screening?.id === post.id ? screening : post;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (post.status !== "pending" || post.moderation_failed || !onStatus) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const updated = await fetchPost(post.id, controller.signal);
        if (controller.signal.aborted) return;
        setScreening(updated);
        onStatus?.(updated.id, updated.status, updated.moderation_failed);
        if (updated.status !== "pending" || updated.moderation_failed) return;
      } catch {
        if (controller.signal.aborted) return;
      }
      timer = setTimeout(() => void refresh(), 5000);
    }
    timer = setTimeout(() => void refresh(), 5000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [post.id, post.status, post.moderation_failed, onStatus]);
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
      {post.author_avatar_upload_id ? <AuthorAvatar id={post.author_avatar_upload_id} /> : <PawIcon size={16} />}<strong className="text-primary">General</strong>
      <span>Posted by {post.author}</span><time dateTime={post.created_at}>{dateFormat.format(new Date(post.created_at))}</time>
      {post.status !== "approved" && <span className="rounded-full bg-accent/10 px-2 py-1 font-semibold text-primary">{post.status === "pending" ? (post.moderation_failed ? "Screening unavailable · Only you" : "Screening pending · Only you") : post.status}</span>}
    </div>
    <h2 className="mb-2 break-words text-base font-semibold">{post.title}</h2>
    {post.status === "pending" && <p role="status" className="mb-3 text-sm text-muted-foreground">
      {screeningView.processing_state === "service_unavailable" ? "Processing service unavailable. Your post stays private; recoverable image inputs are preserved."
        : screeningView.processing_state === "image_rejected" ? "An image was rejected by automatic screening."
        : screeningView.processing_state === "failed" ? "An image could not be processed. Select another image."
        : post.moderation_failed ? "Screening could not finish. Your post stays private."
        : screeningView.processing_state === "waiting_images" ? "Waiting for image processing and moderation." : "Waiting for post moderation."}
    </p>}
    {screeningView.can_retry && post.can_delete && <button type="button" disabled={busy} className="mb-3 text-sm underline" onClick={async () => {
      setBusy(true); setError("");
      try {
        const updated = await retryPostScreening(post.id);
        if (mounted.current) { setScreening(updated); onStatus?.(updated.id, updated.status, updated.moderation_failed); }
      } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to retry screening."); }
      finally { if (mounted.current) setBusy(false); }
    }}>Retry processing and screening</button>}
    {post.status === "blocked" && <p className="mb-3 text-sm text-muted-foreground">Automatic screening flagged this post, so it has not been published.</p>}
    {post.body && <p className="mb-3 whitespace-pre-wrap break-words text-sm">{post.body}</p>}
    {post.url && /^https?:\/\//i.test(post.url) && <a href={post.url} target="_blank" rel="noopener noreferrer" className="mb-3 block break-all text-sm text-primary underline">{post.url}</a>}
    <div className={`grid gap-3 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {post.media.map((media, index) => <PostImage key={media.position} postId={post.id} media={media} status={post.moderation_failed || screeningView.processing_state === "service_unavailable" || screeningView.processing_state === "failed" ? "failed" : post.status} onOpen={() => setViewing(index)} />)}
    </div>
    {viewing !== null && post.media[viewing] && <ImageViewer
      resource={`/posts/${post.id}/media/${post.media[viewing].position}/preview?variant=expanded`}
      title={`${post.title} — image ${viewing + 1} of ${post.media.length}`} onClose={() => setViewing(null)}
      onPrevious={viewing > 0 ? () => setViewing(viewing - 1) : undefined}
      onNext={viewing < post.media.length - 1 ? () => setViewing(viewing + 1) : undefined} />}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      <button type="button" onClick={() => void toggle()} disabled={!canLike || busy} aria-pressed={post.liked}
        aria-label={post.liked ? "Unlike post" : "Like post"}
        className={`rounded-full bg-muted px-3 py-2 font-bold disabled:opacity-50 ${post.liked ? "text-primary" : "text-muted-foreground"}`}>
        ▲ {post.like_count} {post.liked ? "Liked" : "Like"}
      </button>
      <Link href={`/posts/${post.id}`} className="text-muted-foreground underline">{post.comment_count} comments</Link>
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
