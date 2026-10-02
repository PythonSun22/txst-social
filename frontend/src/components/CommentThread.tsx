"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { CurrentProfile } from "@/lib/api";
import { createComment, deleteComment, fetchComments, setCommentLike, type Comment } from "@/lib/comments";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function CommentItem({ comment, postId, profile, onLiked, onChanged }: {
  comment: Comment; postId: string; profile: CurrentProfile | null;
  onLiked: (id: string, value: { liked: boolean; like_count: number }) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const canLike = !!profile?.email_verified && (comment.status === "pending" || comment.status === "approved");
  const canReply = !!profile?.email_verified;

  async function toggleLike() {
    if (!canLike || busy) return;
    setBusy(true); setError("");
    try {
      const result = await setCommentLike(postId, comment.id, !comment.liked);
      onLiked(comment.id, result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update like."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!comment.can_delete || busy) return;
    setBusy(true); setError("");
    try {
      await deleteComment(postId, comment.id);
      onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete comment."); setBusy(false); }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!replyBody.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await createComment(postId, { body: replyBody.trim(), parent_id: comment.id });
      setReplyBody(""); setReplying(false);
      onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to post reply."); setBusy(false); }
  }

  return (
    <div style={{ marginLeft: Math.min(comment.depth, 8) * 20 }} className="border-l border-border pl-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <strong className="text-primary">{comment.author}</strong>
        <time dateTime={comment.created_at}>{dateFormat.format(new Date(comment.created_at))}</time>
        {comment.status !== "approved" && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-primary">{comment.status === "pending" ? "Pending review · Only you" : comment.status}</span>}
      </div>
      <p className="mb-2 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => void toggleLike()} disabled={!canLike || busy} aria-pressed={comment.liked}
          aria-label={comment.liked ? "Unlike comment" : "Like comment"}
          className={`rounded-full bg-muted px-2 py-1 font-bold disabled:opacity-50 ${comment.liked ? "text-primary" : "text-muted-foreground"}`}>
          ▲ {comment.like_count}
        </button>
        {canReply && !replying && <button type="button" disabled={busy} onClick={() => setReplying(true)} className="text-muted-foreground underline">Reply</button>}
        {comment.can_delete && !confirmDelete && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="text-red-700">Delete</button>}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      {comment.can_delete && confirmDelete && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Confirm comment deletion">
          <p>Delete this comment?</p>
          <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-full bg-red-700 px-2 py-1 text-white disabled:opacity-50">{busy ? "Deleting…" : "Confirm"}</button>
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="rounded-full border border-border px-2 py-1">Cancel</button>
        </div>
      )}
      {replying && (
        <form onSubmit={submitReply} className="mt-2 space-y-2">
          <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} required maxLength={10000}
            className="block w-full rounded border border-border p-2 text-sm" rows={2} placeholder="Write a reply…" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !replyBody.trim()} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Posting…" : "Post reply"}</button>
            <button type="button" disabled={busy} onClick={() => setReplying(false)} className="rounded-full border border-border px-3 py-1 text-xs">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function CommentThread({ postId, profile }: { postId: string; profile: CurrentProfile | null }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [composerError, setComposerError] = useState("");

  async function reload(signal?: AbortSignal) {
    try {
      const thread = await fetchComments(postId, signal);
      if (!signal?.aborted) { setComments(thread.items); setError(""); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load comments.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      await reload(controller.signal);
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload is stable per postId, not a dependency.
  }, [postId]);

  async function submitTopLevel(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true); setComposerError("");
    try {
      await createComment(postId, { body: body.trim() });
      setBody("");
      await reload();
    } catch (cause) { setComposerError(cause instanceof Error ? cause.message : "Unable to post comment."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {profile?.email_verified ? (
        <form onSubmit={submitTopLevel} className="space-y-2">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={10000}
            className="block w-full rounded border border-border p-2 text-sm" rows={3} placeholder="Add a comment…" />
          <button type="submit" disabled={busy || !body.trim()} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Posting…" : "Post comment"}
          </button>
          {composerError && <p role="alert" className="text-sm text-red-700">{composerError}</p>}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{profile ? "Verify your email to comment." : "Sign in to comment."}</p>
      )}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading comments…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && !error && !comments.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} postId={postId} profile={profile}
          onLiked={(id, value) => setComments((current) => current.map((c) => c.id === id ? { ...c, ...value } : c))}
          onChanged={() => void reload()}
        />
      ))}
    </div>
  );
}
