import Link from "next/link";
import PostSearch from "@/components/posts/PostSearch";
import SpaceFeed from "@/components/posts/SpaceFeed";

export default function Home() {
  return (
    <>
      <section className="feed-intro" aria-labelledby="feed-heading">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f2d492]">Texas State · Campus-wide</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 id="feed-heading" className="font-serif text-5xl font-bold tracking-tight">ForAll<span className="text-[#f2d492]">.</span></h1>
          <span className="rounded-full border border-white/30 px-3 py-1 text-xs text-white/90">Newest first</span>
        </div>
        <p className="mt-3 text-sm text-white/85">Your campus. Your conversations.</p>
      </section>
      <PostSearch />
      <Link href="/submit" className="mb-5 block rounded-card border border-primary bg-primary px-5 py-4 text-sm font-bold text-white">+ Create Post</Link>
      <SpaceFeed space="general" />
    </>
  );
}
