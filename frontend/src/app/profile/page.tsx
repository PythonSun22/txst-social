"use client";

import PostCard, { type ModerationStatus } from "@/components/PostCard";
import SortBar, { type SortOrder } from "@/components/SortBar";
import Link from "next/link";
import { useState } from "react";

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

// Temporary profile information until we connect /auth/me.
const profile = {
  display_name: "Mr. Lynx",
  username: "mrlynx",
  bio: "Computer Science student at Texas State University.",
  initials: "ML",
};

// Temporary posts until we connect the current user's posts API.
const initialPosts: Post[] = [
  {
    id: 1,
    author: "Mr. Lynx",
    title: "Hello, world!",
    body: "My first post on Boko Lynx.",
    like_count: 6,
    comment_count: 7,
    created_at: "2026-09-20T14:05:00Z",
    status: "approved",
  },
];

function sortPosts(posts: Post[], order: SortOrder): Post[] {
  const time = (post: Post) =>
    new Date(post.created_at).getTime() / 1000;

  const hot = (post: Post) =>
    Math.log10(Math.max(post.like_count, 1)) + time(post) / 45000;

  const key = {
    hot,
    new: time,
    top: (post: Post) => post.like_count,
  }[order];

  return [...posts].sort((a, b) => key(b) - key(a));
}

export default function Profile() {
  const [sort, setSort] = useState<SortOrder>("new");
  const posts = sortPosts(initialPosts, sort);

  return (
    <section>
      {/* Profile header */}
      <div className="mb-4 rounded-card border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white"
          >
            {profile.initials}
          </div>

          <div className="min-w-0">
            <h1 className="break-words font-serif text-xl font-bold text-primary">
              {profile.display_name}
            </h1>
            <p className="break-words text-sm text-muted-foreground">
              @{profile.username}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm">{profile.bio}</p>
      </div>

      {/* Personal feed */}
      <h2 className="mb-3 font-serif text-lg font-bold text-primary">
        My Posts
      </h2>

      <Link
        href="/submit"
        className="mb-3 flex items-center gap-2 rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-base leading-none text-white"
        >
          +
        </span>
        Create Post
      </Link>

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
    </section>
  );
}