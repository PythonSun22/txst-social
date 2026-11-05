import Link from "next/link";
import PostSearch from "@/components/posts/PostSearch";
import SpaceFeed from "@/components/posts/SpaceFeed";

export default function Home() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-primary">ForAll</h1>
        <span className="text-xs text-muted-foreground">Newest first</span>
      </div>
      <PostSearch />
      <Link href="/submit" className="mb-4 block rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-primary">+ Create Post</Link>
      <SpaceFeed space="general" />
    </>
  );
}
