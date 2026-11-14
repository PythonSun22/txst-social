"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SpaceList from "@/components/spaces/SpaceList";
import { useSpaces } from "@/components/spaces/SpacesProvider";
import { getProfileSpaces, type Space } from "@/lib/spaces";

/** Own profiles use shared follow state; public profiles load that student's spaces. */
export default function JoinedCommunitiesCard({ profileId }: { profileId?: string }) {
  const own = useSpaces();
  const [saved, setSaved] = useState<{ id: string; spaces: Space[]; error: string } | null>(null);
  useEffect(() => {
    if (!profileId) return;
    const controller = new AbortController();
    getProfileSpaces(profileId, controller.signal)
      .then((spaces) => { if (!controller.signal.aborted) setSaved({ id: profileId, spaces, error: "" }); })
      .catch((cause) => {
        if (!controller.signal.aborted) setSaved({ id: profileId, spaces: [], error: cause instanceof Error ? cause.message : "Unable to load joined spaces." });
      });
    return () => controller.abort();
  }, [profileId]);
  const result = saved?.id === profileId ? saved : null;
  const spaces = profileId ? result?.spaces ?? [] : own.spaces.filter((space) => space.is_following);
  const loading = profileId ? !result : own.loading;
  const error = profileId ? result?.error : own.error;

  return <aside aria-label="Joined spaces" className="self-start overflow-hidden rounded-card border border-border border-t-4 border-t-accent bg-card p-5 shadow-sm lg:sticky lg:top-28">
    <h2 className="mb-1 font-serif text-xl font-bold text-primary">Joined Spaces</h2>
    <p className="mb-5 text-xs text-muted-foreground">{profileId ? "Their spaces around campus." : "Your spaces around campus."}</p>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading joined spaces…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && spaces.length > 0 && <SpaceList spaces={spaces} readOnly />}
    {!loading && !error && !spaces.length && <p className="rounded-card border border-dashed border-border bg-secondary p-4 text-sm text-muted-foreground">{profileId ? "Communities they join will appear here." : "Communities you join will appear here."}</p>}
    {!profileId && <Link href="/spaces" className="mt-5 block text-sm font-semibold text-primary underline">Explore Spaces →</Link>}
  </aside>;
}
