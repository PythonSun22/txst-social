"use client";

import Link from "next/link";
import SpaceAvatar from "./SpaceAvatar";
import { spaceHref, type Space } from "@/lib/spaces";
import { useSpaces } from "./SpacesProvider";

export default function SpaceList({ spaces, readOnly = false, variant = "list", visibleRows, label }: {
  spaces: Space[]; readOnly?: boolean; variant?: "list" | "cards" | "compact";
  visibleRows?: number;
  label?: string;
}) {
  const { profile, busy, follow } = useSpaces();
  const cards = variant === "cards";
  const compact = variant === "compact";
  const rowLimit = compact ? visibleRows : undefined;
  return <ul aria-label={label} tabIndex={rowLimit && spaces.length > rowLimit ? 0 : undefined}
    style={rowLimit ? { maxHeight: `${rowLimit * 3}rem` } : undefined}
    className={`${cards ? "grid auto-cols-[18rem] grid-flow-col grid-rows-2 gap-4 sm:auto-cols-[20rem]" : "divide-y divide-border"} ${rowLimit ? "overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : ""}`}>
    {spaces.map((space) => {
      const details = `${space.follower_count.toLocaleString()} ${space.follower_count === 1 ? "follower" : "followers"} · ${space.kind === "college" ? "College" : "Community"}`;
      return <li key={space.id} className={cards
      ? "flex h-full snap-start flex-col items-start gap-3 rounded-card border border-border border-t-4 border-t-accent bg-card p-4 shadow-sm"
      : compact ? "flex h-12 min-w-0 items-center gap-2 py-2" : "flex items-center gap-3 py-4 first:pt-0 last:pb-0"}>
      <Link href={spaceHref(space.slug)} title={compact ? space.name : undefined} className={`flex min-w-0 flex-1 ${cards ? "w-full items-start gap-3" : compact ? "items-center gap-2" : "items-center gap-3"}`}>
        <SpaceAvatar space={space} size={cards ? 48 : compact ? 32 : 40} iconSize={cards ? 28 : compact ? 18 : 20} />
        <span className="min-w-0">
          <span className={`font-bold text-primary hover:underline ${compact ? "line-clamp-2" : "block"} ${cards ? "font-serif text-xl" : space.kind === "college" ? "font-serif text-sm" : "text-sm"}`}>{space.name}</span>
          {cards && <span className="mt-2 block text-sm leading-5 text-muted-foreground">{space.description}</span>}
          {!cards && !compact && <span className="mt-1 block text-xs text-muted-foreground">{details}</span>}
        </span>
      </Link>
      {!compact && <div className={cards ? "flex w-full flex-wrap items-center gap-x-3 gap-y-2" : "contents"}>
      {!readOnly && (profile ? <button type="button" disabled={busy !== null || !profile.email_verified}
        title={!profile.email_verified ? "Verify your email to follow spaces." : undefined}
        aria-label={`${space.is_following ? "Unfollow" : "Follow"} ${space.name}`}
        onClick={() => void follow(space.slug, !space.is_following)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50 ${space.is_following ? "border-transparent bg-muted" : "border-primary/40 hover:bg-muted"}`}>
        {busy === space.slug ? "Saving…" : space.is_following ? "✓ Following" : "Follow"}
      </button> : <Link href="/login" className="shrink-0 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary">Follow</Link>)}
      {cards && <span className="text-xs text-muted-foreground">{details}</span>}
      </div>}
    </li>;
    })}
  </ul>;
}
