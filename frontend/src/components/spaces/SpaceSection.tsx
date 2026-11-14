"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import SpaceList from "./SpaceList";
import type { Space } from "@/lib/spaces";

/** Shared two-row directory with independent scrolling for each group. */
export default function SpaceSection({ id, title, description, spaces, emptyMessage, actions, heading: Heading = "h2" }: {
  id: string;
  title: string;
  description: string;
  spaces: Space[];
  emptyMessage?: string;
  actions?: ReactNode;
  heading?: "h1" | "h2";
}) {
  const ordered = [...spaces].sort((a, b) => b.follower_count - a.follower_count || a.name.localeCompare(b.name));
  const viewport = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScroll = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    const left = element.scrollLeft > 1;
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setCanScroll((previous) => previous.left === left && previous.right === right ? previous : { left, right });
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [spaces.length, updateScroll]);

  function scroll(direction: number) {
    const element = viewport.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return <section aria-labelledby={`${id}-heading`}>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <Heading id={`${id}-heading`} className="font-serif text-3xl font-bold text-primary">{title}</Heading>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button type="button" aria-label={`Scroll ${title.toLowerCase()} left`} aria-controls={id} disabled={!canScroll.left} onClick={() => scroll(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-card text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" aria-label={`Scroll ${title.toLowerCase()} right`} aria-controls={id} disabled={!canScroll.right} onClick={() => scroll(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-card text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
    <div id={id} ref={viewport} onScroll={updateScroll} role="region" aria-label={title} tabIndex={0}
      className="-mx-1 snap-x snap-proximity overflow-x-auto px-1 pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <SpaceList spaces={ordered} variant="cards" />
      {ordered.length === 0 && emptyMessage && <p className="flex min-h-40 items-center rounded-card border border-dashed border-border bg-card/50 px-6 py-8 text-sm text-muted-foreground">{emptyMessage}</p>}
    </div>
  </section>;
}
