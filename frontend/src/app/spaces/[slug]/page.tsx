"use client";

import Link from "next/link";
import { use } from "react";
import SpaceFeed from "@/components/posts/SpaceFeed";
import SpaceList from "@/components/spaces/SpaceList";
import { useSpaces } from "@/components/spaces/SpacesProvider";

export default function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { spaces, loading, error, reload } = useSpaces();
  const space = spaces.find((item) => item.slug === slug);
  if (loading) return <p role="status">Loading space…</p>;
  if (error) return <p role="alert">{error} <button type="button" onClick={reload} className="underline">Retry</button></p>;
  if (!space) return <h1 className="font-serif text-xl font-bold text-primary">Space not found</h1>;
  return <section>
    <Link href="/spaces" className="text-sm font-semibold text-primary hover:underline">← All spaces</Link>
    <header className="mb-5 mt-4 overflow-hidden rounded-card border border-border bg-card shadow-sm">
      <div aria-hidden="true" className="h-20 border-b-4 border-accent bg-primary" />
      <div className="p-5">
        <h1 className="font-serif text-2xl font-bold text-primary">{space.name}</h1>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">{space.description}</p>
        <SpaceList spaces={[space]} />
      </div>
    </header>
    {space.rules && <section aria-label="Space rules" className="mb-5 rounded-card border border-border bg-card p-4">
      <h2 className="font-semibold text-primary">Rules</h2>
      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{space.rules}</p>
    </section>}
    <Link href={`/submit?space=${encodeURIComponent(slug)}`} className="mb-4 block rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-primary">+ Create Post</Link>
    <SpaceFeed space={slug} />
  </section>;
}
