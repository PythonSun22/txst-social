"use client";

import { useState } from "react";
import Link from "next/link";
import { getProfileConnections, type ProfileListItem } from "@/lib/api";

/** Expand a profile's public followers or following list. */
export default function UserConnections({
  profileId,
  followerCount,
  followingCount,
  ownProfile = false,
}: {
  profileId: string;
  followerCount: number;
  followingCount: number;
  ownProfile?: boolean;
}) {
  const [view, setView] = useState<"followers" | "following" | null>(null);
  const [people, setPeople] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle(kind: "followers" | "following") {
    if (view === kind) {
      setView(null);
      return;
    }
    setView(kind);
    setLoading(true);
    setError("");
    try {
      setPeople(await getProfileConnections(profileId, kind));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load this list.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => void toggle("followers")} aria-expanded={view === "followers"} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-primary hover:bg-secondary">
        <strong>{followerCount}</strong> Followers
      </button>
      <button type="button" onClick={() => void toggle("following")} aria-expanded={view === "following"} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-primary hover:bg-secondary">
        <strong>{followingCount}</strong> Following
      </button>
    </div>
    {view && <section className="mt-3 max-w-xl rounded-card border border-border bg-secondary p-3" aria-label={view}>
      <h2 className="font-serif font-bold text-primary">
        {ownProfile
          ? view === "followers" ? "People following you" : "People you follow"
          : view === "followers" ? "Followers" : "Following"}
      </h2>
      {loading && <p role="status" className="mt-2 text-sm">Loading…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-primary">{error}</p>}
      {!loading && !error && people.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No {view} yet.</p>}
      <ul className="mt-2 divide-y divide-border">
        {people.map((person) => <li key={person.id} className="py-2">
          <Link href={`/profile/${person.id}`} className="font-semibold text-primary hover:underline">{person.display_name || person.username}</Link>
          <span className="ml-2 text-sm text-muted-foreground">@{person.username}</span>
        </li>)}
      </ul>
    </section>}
  </>;
}
