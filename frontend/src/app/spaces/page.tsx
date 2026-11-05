"use client";

import SpaceList from "@/components/spaces/SpaceList";
import { useSpaces } from "@/components/spaces/SpacesProvider";

export default function SpacesPage() {
  const { spaces, loading, error, reload } = useSpaces();
  return <section>
    <h1 className="font-serif text-2xl font-bold text-primary">Spaces</h1>
    <p className="mb-6 mt-2 text-sm text-muted-foreground">Find your people, from your college to your favorite interests.</p>
    {loading && <p role="status">Loading spaces…</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error} <button type="button" onClick={reload} className="underline">Retry</button></p>}
    {(["community", "college"] as const).map((kind) => <section key={kind} className="mb-6 rounded-card border border-border border-t-4 border-t-accent bg-card p-5 shadow-sm">
      <h2 className="mb-5 font-serif text-xl font-bold text-primary">{kind === "college" ? "Colleges" : "Communities"}</h2>
      <SpaceList spaces={spaces.filter((space) => space.kind === kind)} />
    </section>)}
  </section>;
}
