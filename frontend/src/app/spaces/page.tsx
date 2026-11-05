"use client";

import Link from "next/link";
import SpaceSection from "@/components/spaces/SpaceSection";
import { useSpaces } from "@/components/spaces/SpacesProvider";

export default function SpacesPage() {
  const { spaces, loading, error, reload } = useSpaces();
  const communities = spaces.filter((space) => space.kind === "community");
  const showEmpty = !loading && !error;
  return <>
    {loading && <p role="status">Loading spaces…</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error} <button type="button" onClick={reload} className="underline">Retry</button></p>}
    <div className="space-y-10">
      <SpaceSection id="general-spaces" title="General spaces" heading="h1"
        description="Discover communities for your interests and life at Texas State."
        spaces={communities.filter((space) => space.is_seeded)}
        emptyMessage={showEmpty ? "No general spaces are available yet." : undefined} />
      <SpaceSection id="user-spaces" title="User Spaces"
        description="Discover communities created by students."
        actions={<Link href="/spaces/create" className="mr-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">+ Create Space</Link>}
        spaces={communities.filter((space) => !space.is_seeded)}
        emptyMessage={showEmpty ? "User-created spaces will appear here." : undefined} />
    </div>
  </>;
}
