"use client";

import Link from "next/link";
import SpaceList from "./SpaceList";
import { useSpaces } from "./SpacesProvider";

function SidebarSections() {
  const { spaces, loading, error, reload } = useSpaces();
  const joined = spaces.filter((space) => space.is_following);
  const suggested = spaces.filter((space) => !space.is_following).slice(0, 2);
  return <div className="space-y-5">
    {joined.length > 0 && <section className="rounded-card border border-border border-t-4 border-t-accent bg-card p-4 shadow-sm">
      <h2 className="mb-4 font-serif text-xl font-bold text-primary">Your Spaces</h2>
      <SpaceList spaces={joined} />
    </section>}
    <section className="rounded-card border border-border border-t-4 border-t-accent bg-card p-4 shadow-sm">
      <h2 className="font-serif text-xl font-bold text-primary">Suggested Spaces</h2>
      <p className="mb-5 mt-1 text-xs text-muted-foreground">Find your community at TXST.</p>
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading spaces…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error} <button type="button" onClick={reload} className="underline">Retry</button></p>}
      {!loading && !error && !suggested.length && <p className="text-sm text-muted-foreground">You’re following all available spaces.</p>}
      <SpaceList spaces={suggested} />
      <Link href="/spaces" className="mt-5 block rounded-full bg-primary px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-primary/90">Explore more →</Link>
    </section>
  </div>;
}

export default function SpacesSidebar() {
  return <aside aria-label="Spaces" className="min-w-0 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
    <div className="hidden xl:block"><SidebarSections /></div>
    <details className="xl:hidden">
      <summary className="cursor-pointer rounded-card border border-border bg-card px-4 py-3 font-serif font-bold text-primary">Your Spaces & Suggestions</summary>
      <div className="mt-3"><SidebarSections /></div>
    </details>
  </aside>;
}
