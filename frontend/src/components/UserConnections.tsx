"use client";

import { useEffect, useRef, useState } from "react";
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
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function toggle(kind: "followers" | "following") {
    request.current?.abort();
    request.current = null;
    if (view === kind) {
      setView(null);
      return;
    }
    const current = new AbortController();
    request.current = current;
    setView(kind);
    setPeople([]);
    setLoading(true);
    setError("");
    try {
      const people = await getProfileConnections(profileId, kind, current.signal);
      if (!current.signal.aborted) setPeople(people);
    } catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load this list.");
    } finally {
      if (!current.signal.aborted) setLoading(false);
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
          : view === "followers" ? "People following them" : "People they follow"}
      </h2>
      {loading && <p role="status" className="mt-2 text-sm">Loading…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-primary">{error}</p>}
      {!loading && !error && people.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{view === "followers"
        ? ownProfile ? "No one is following you yet." : "No one is following them yet."
        : ownProfile ? "You aren’t following anyone yet." : "They aren’t following anyone yet."}</p>}
      <ul className="mt-2 divide-y divide-border">
        {people.map((person) => <li key={person.id} className="py-2">
          <Link href={`/profile/${person.id}`} className="font-semibold text-primary hover:underline">{person.display_name || person.username}</Link>
          <span className="ml-2 text-sm text-muted-foreground">@{person.username}</span>
        </li>)}
      </ul>
    </section>}
  </>;
}
