"use client";
import { useState } from "react";
import PawIcon from "@/components/PawIcon";

/** Mirrors the `moderation_status` enum in the core migration (FR-90). */
export type ModerationStatus = "pending" | "approved" | "blocked" | "removed";

interface PostCardProps {
  spaceName: string;
  author: string;
  /** ISO timestamp from `posts.created_at`. */
  createdAt: string;
  title: string;
  body: string;
  likes: number;
  commentCount: number;
  status: ModerationStatus;
}

// Fixed locale and time zone so the server render and the browser agree
// (a mismatch here causes a React hydration error).
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

/**
 * One post in a feed, styled after the Figma Make mockup.
 *
 * Upvotes only (AGENTS.md §2): a single like toggle, no downvote. A `pending`
 * post has been submitted but not yet approved by the classifier; the API only
 * returns it to its author, so the badge tells them why nobody else sees it.
 * The like is local state until the likes endpoint exists.
 */
function PostCard({ spaceName, author, createdAt, title, body, likes, commentCount, status }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const likeCount = likes + (isLiked ? 1 : 0);

  return (
    <article className="w-full rounded-card border border-border bg-card transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1.5 pt-3 text-xs text-muted-foreground">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <PawIcon size={12} />
        </span>
        <span className="font-bold text-primary">{spaceName}</span>
        <span aria-hidden="true">•</span>
        <span>Posted by {author}</span>
        <time dateTime={createdAt}>{dateFormat.format(new Date(createdAt))}</time>
        {status === "pending" && (
          <span
            className="ml-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-semibold text-[#8a6418]"
            title="Only you can see this post until moderation approves it."
          >
            Pending review
          </span>
        )}
      </div>

      <h2 className="mb-2 px-4 text-[15px] font-semibold leading-snug text-foreground">{title}</h2>
      <p className="mb-3 px-4 text-sm leading-relaxed text-muted-foreground">{body}</p>

      <div className="flex items-center gap-1 px-3 pb-3">
        <button
          type="button"
          onClick={() => setIsLiked((liked) => !liked)}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike" : "Like"}
          className={`flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-bold transition-colors ${
            isLiked ? "text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 4l8 8H4z" />
          </svg>
          {likeCount}
        </button>

        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
        </span>
      </div>
    </article>
  );
}

export default PostCard;
