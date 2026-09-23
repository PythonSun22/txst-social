"use client";
import PostCard, { type ModerationStatus } from "@/components/PostCard";
import SortBar, { type SortOrder } from "@/components/SortBar";
import { useState } from "react";

// Field names follow the `posts` table so swapping in the API response is easy.
interface Post {
  id: number;
  author: string;
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  status: ModerationStatus;
}

// Placeholder data until GET /posts exists (PLAN.md step 2).
const initialPosts: Post[] = [
  { id: 1, author: "Seth", title: "Hello, world!", body: "First post on Boko Lynx.", like_count: 10, comment_count: 2, created_at: "2026-09-20T14:05:00Z", status: "approved" },
  { id: 2, author: "Sachin", title: "This is a great post!", body: "Testing the new card layout.", like_count: 15, comment_count: 4, created_at: "2026-09-21T09:30:00Z", status: "approved" },
  { id: 3, author: "Misan", title: "I love this!", body: "Maroon and gold looks right.", like_count: 11, comment_count: 1, created_at: "2026-09-21T18:45:00Z", status: "approved" },
  { id: 4, author: "Adam B", title: "Supabase post!", body: "Auth is wired up.", like_count: 10, comment_count: 0, created_at: "2026-09-22T11:10:00Z", status: "approved" },
  { id: 5, author: "Adam S", title: "Backend post", body: "FastAPI is serving /auth/me.", like_count: 12, comment_count: 3, created_at: "2026-09-22T16:20:00Z", status: "approved" },
  { id: 6, author: "Daniel", title: "Schema post", body: "Waiting on the classifier, so only I can see this one.", like_count: 0, comment_count: 0, created_at: "2026-09-23T10:00:00Z", status: "pending" },
];

// Stand-in for the ordering the API will do. The real Hot order reads the
// stored hot_rank column (FR-54); this uses the same formula on the mock rows.
function sortPosts(posts: Post[], order: SortOrder): Post[] {
  const time = (p: Post) => new Date(p.created_at).getTime() / 1000;
  const hot = (p: Post) => Math.log10(Math.max(p.like_count, 1)) + time(p) / 45000;
  const key = { hot, new: time, top: (p: Post) => p.like_count }[order];
  return [...posts].sort((a, b) => key(b) - key(a));
}

export default function Home() {
  const [sort, setSort] = useState<SortOrder>("hot");
  const posts = sortPosts(initialPosts, sort);

  return (
    <>
      {/* ForAll is the General space: one place you post to, not a blend of every space. */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-primary">ForAll</h1>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Eat &apos;Em Up, Kats!
        </span>
      </div>

      <SortBar value={sort} onChange={setSort} />

      <div className="flex flex-col gap-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            spaceName="General"
            author={post.author}
            createdAt={post.created_at}
            title={post.title}
            body={post.body}
            likes={post.like_count}
            commentCount={post.comment_count}
            status={post.status}
          />
        ))}
      </div>
    </>
  );
}
