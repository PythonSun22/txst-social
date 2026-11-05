"use client";

import Link from "next/link";
import SpaceIcon from "./SpaceIcon";
import { spaceHref, type Space } from "@/lib/spaces";
import { useSpaces } from "./SpacesProvider";

export default function SpaceList({ spaces, readOnly = false }: { spaces: Space[]; readOnly?: boolean }) {
  const { profile, busy, follow } = useSpaces();
  return <ul className="divide-y divide-border">
    {spaces.map((space) => <li key={space.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
      <Link href={spaceHref(space.slug)} className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${space.kind === "college" ? "bg-accent text-primary" : "bg-primary text-accent"}`}><SpaceIcon slug={space.slug} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-primary hover:underline">{space.name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{space.follower_count.toLocaleString()} {space.follower_count === 1 ? "follower" : "followers"} · {space.kind === "college" ? "College" : "Community"}</span>
        </span>
      </Link>
      {!readOnly && (profile ? <button type="button" disabled={busy !== null || !profile.email_verified}
        title={!profile.email_verified ? "Verify your email to follow spaces." : undefined}
        aria-label={`${space.is_following ? "Unfollow" : "Follow"} ${space.name}`}
        onClick={() => void follow(space.slug, !space.is_following)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50 ${space.is_following ? "border-transparent bg-muted" : "border-primary/40 hover:bg-muted"}`}>
        {busy === space.slug ? "Saving…" : space.is_following ? "✓ Following" : "Follow"}
      </button> : <Link href="/login" className="shrink-0 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary">Follow</Link>)}
    </li>)}
  </ul>;
}
