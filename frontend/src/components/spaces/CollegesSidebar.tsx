"use client";

import Link from "next/link";
import SpaceIcon from "./SpaceIcon";
import SpaceList from "./SpaceList";
import { useSpaces } from "./SpacesProvider";

function CollegeSections() {
  const { spaces, profile, loading, error, reload } = useSpaces();
  const main = profile?.home_college;
  const others = spaces.filter((space) => space.kind === "college" && space.is_following && space.id !== main?.id);
  return <section className="rounded-card border border-border border-t-4 border-t-accent bg-card p-4 shadow-sm">
    <h2 className="font-serif text-lg font-bold text-primary">Your Colleges</h2>
    {loading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Loading colleges…</p>
      : error ? <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" onClick={reload} className="underline">Retry</button></p>
        : !profile ? <p className="mt-3 text-sm text-muted-foreground"><Link href="/login" className="font-semibold text-primary underline">Sign in</Link> to see your colleges.</p>
          : <>
            {main ? <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your main college</p>
              <Link href={`/colleges/${encodeURIComponent(main.slug)}`} className="mt-3 flex flex-col items-start gap-3 rounded-lg text-primary hover:underline">
                <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-accent"><SpaceIcon slug={main.slug} size={44} /></span>
                <h3 className="font-serif text-2xl font-bold leading-tight">{main.name}</h3>
              </Link>
            </> : <p className="mt-4 text-sm text-muted-foreground">Choose your main college in <Link href="/profile" className="font-semibold text-primary underline">your profile</Link>.</p>}
            {others.length > 0 && <div className="mt-5 border-t border-border pt-3">
              <h3 className="mb-2 font-serif text-sm font-bold text-primary">Other joined colleges</h3>
              <SpaceList spaces={others} variant="compact" visibleRows={3} label="Other joined colleges" />
              {others.length > 3 && <p className="mt-2 text-xs text-muted-foreground">Scroll to see more colleges.</p>}
            </div>}
          </>}
    <Link href="/colleges" className="mt-5 block text-sm font-semibold text-primary hover:underline">Explore colleges →</Link>
  </section>;
}

export default function CollegesSidebar() {
  return <aside aria-label="Colleges" className="min-w-0 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
    <div className="hidden xl:block"><CollegeSections /></div>
    <details className="xl:hidden">
      <summary className="cursor-pointer rounded-card border border-border bg-card px-4 py-3 font-serif font-bold text-primary">Your Colleges</summary>
      <div className="mt-3"><CollegeSections /></div>
    </details>
  </aside>;
}
