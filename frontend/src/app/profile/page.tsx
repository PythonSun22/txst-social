"use client";

import PostCard from "@/components/PostCard";
import SortBar, { type SortOrder } from "@/components/SortBar";
import {
  getCurrentProfile,
  getMyPosts,
  type CurrentProfile,
  type Post,
} from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const posts = sortPosts(myPosts, sort);

  // Load the authenticated profile when this component mounts.
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const data = await getCurrentProfile();
        const userPosts = data ? await getMyPosts() : [];

        if (active) {
            setProfile(data);
            setMyPosts(userPosts);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your profile."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    // Ignore the result if this component has unmounted.
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p>Loading your profile...</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-primary">
        {error}
      </p>
    );
  }

  if (!profile) {
    return (
      <p>
        Please{" "}
        <Link href="/login" className="text-primary underline">
          sign in
        </Link>{" "}
        to view your profile.
      </p>
    );
  }

  const displayName = profile.display_name || profile.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <section>
      {/* Real profile information from GET /auth/me */}
      <div className="mb-4 rounded-card border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white"
          >
            {initials}
          </div>

          <div className="min-w-0">
            <h1 className="break-words font-serif text-xl font-bold text-primary">
              {displayName}
            </h1>

            <p className="break-words text-sm text-muted-foreground">
              @{profile.username}
            </p>
          </div>
        </div>
      </div>

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
      {posts.length === 0 && (
        <p className="text-sm text-muted-foreground">
            No posts to show yet.
        </p>
        )}

      <div className="flex flex-col gap-3">
        {posts.map((post) => (
        <PostCard
            key={post.id}
            spaceName="Space"
            author={displayName}
            createdAt={post.created_at}
            title={post.title}
            body={post.body ?? ""}
            likes={post.like_count}
            commentCount={post.comment_count}
            status={post.status}
        />
        ))}
      </div>
    </section>
  );
}