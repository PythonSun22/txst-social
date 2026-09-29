"use client";

/* eslint-disable @next/next/no-img-element -- Signed private image URLs are generated at runtime. */

import PostCard from "@/components/PostCard";
import PawIcon from "@/components/PawIcon";
import JoinedCommunitiesCard from "@/components/JoinedCommunitiesCard";
import EditProfileModal from "@/components/EditProfileModal";
import SortBar, { type SortOrder } from "@/components/SortBar";
import {
  getCurrentProfile,
  type CurrentProfile,
} from "@/lib/api";
import { getMyPosts, type FeedPost } from "@/lib/posts";
import { previewImage } from "@/lib/images/image-api";
import Link from "next/link";
import { useEffect, useState } from "react";

function sortPosts(posts: FeedPost[], order: SortOrder): FeedPost[] {
  const time = (post: FeedPost) =>
    new Date(post.created_at).getTime() / 1000;

  const hot = (post: FeedPost) =>
    Math.log10(Math.max(post.like_count, 1)) + time(post) / 45000;

  const key = {
    hot,
    new: time,
    top: (post: FeedPost) => post.like_count,
  }[order];

  return [...posts].sort((a, b) => key(b) - key(a));
}

function usePrivateImagePreview(uploadId: string | null): string | null {
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (uploadId) {
      previewImage(uploadId)
        .then((result) => { if (active) setPreview({ id: uploadId, url: result.url }); })
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [uploadId]);

  return preview?.id === uploadId ? preview.url : null;
}

export default function Profile() {
  const [sort, setSort] = useState<SortOrder>("new");
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [editing, setEditing] = useState(false);
  const posts = sortPosts(myPosts, sort);
  const avatarUrl = usePrivateImagePreview(profile?.profile_image_upload_id ?? null);
  const bannerUrl = usePrivateImagePreview(profile?.banner_image_upload_id ?? null);

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
    <section className="space-y-6 lg:relative lg:left-1/2 lg:w-[min(72rem,calc(100vw-3rem))] lg:-translate-x-1/2">
      {/* Real profile information from GET /auth/me */}
      <article className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
        <div
          aria-hidden="true"
          className="relative h-40 overflow-hidden"
          style={{ backgroundColor: profile.home_college?.accent_hex ?? "#501214" }}
        >
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute right-8 top-1/2 -translate-y-1/2 rotate-[-10deg] text-accent/70">
              <PawIcon size={104} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-accent" />
        </div>

        <div className="px-5 pb-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-7">
            <div
              aria-hidden="true"
              className="relative -mt-16 flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-[5px] border-card bg-primary text-3xl font-bold text-white shadow-md sm:-mt-20 sm:h-40 sm:w-40 sm:text-4xl"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={`${displayName}'s profile`} className="h-full w-full rounded-full object-cover" />
              ) : initials}
              <span className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-card bg-accent text-white">
                <PawIcon size={17} />
              </span>
            </div>

            <div className="min-w-0 flex-1 sm:pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-words font-serif text-3xl font-bold leading-tight text-primary">
                  {displayName}
                </h1>
                <button type="button" onClick={() => setEditing(true)} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90">
                  Edit Profile
                </button>
              </div>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                @{profile.username}
              </p>

              <p className={`mt-4 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 ${profile.bio ? "text-foreground" : "italic text-muted-foreground"}`}>
                {profile.bio || "No bio added yet."}
              </p>

              <dl className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m2 10 10-5 10 5-10 5L2 10Z" />
                    <path d="M6 12v5c3 2 9 2 12 0v-5" />
                  </svg>
                  <dt className="sr-only">Major</dt>
                  <dd>{profile.major || "Major not specified"}</dd>
                </div>
                <span aria-hidden="true" className="text-accent">•</span>
                <div className="flex items-center gap-2">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="7" r="4" />
                    <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
                  </svg>
                  <dt className="sr-only">Student level</dt>
                  <dd className="capitalize">{profile.student_level || "Level not specified"}</dd>
                </div>
                <span aria-hidden="true" className="text-accent">•</span>
                <div className="flex items-center gap-2">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 21h18" />
                    <path d="M5 21V9l7-4 7 4v12" />
                    <path d="M9 21v-6h6v6" />
                  </svg>
                  <dt className="sr-only">Home college</dt>
                  <dd>{profile.home_college?.short_name || "College not selected"}</dd>
                </div>
              </dl>

              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <dd className="font-serif text-lg font-bold text-primary">{profile.joined_community_count}</dd>
                  <dt className="text-sm text-muted-foreground">Communities joined</dt>
                </div>
                <div className="flex items-baseline gap-2">
                  <dd className="font-serif text-lg font-bold text-primary">{profile.followed_space_count}</dd>
                  <dt className="text-sm text-muted-foreground">Spaces followed</dt>
                </div>
              </dl>

              <dl className="mt-4 flex flex-wrap gap-2">
                <div className="flex items-baseline gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
                  <dd className="font-serif text-sm font-bold text-primary">{profile.post_karma}</dd>
                  <dt className="text-[11px] text-muted-foreground">Post karma</dt>
                </div>
                <div className="flex items-baseline gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
                  <dd className="font-serif text-sm font-bold text-primary">{profile.comment_karma}</dd>
                  <dt className="text-[11px] text-muted-foreground">Comment karma</dt>
                </div>
                <div className="flex items-baseline gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
                  <dd className="font-serif text-sm font-bold text-primary">{myPosts.length}</dd>
                  <dt className="text-[11px] text-muted-foreground">Posts</dt>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </article>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-primary">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent bg-card text-accent shadow-sm">
                <PawIcon size={15} />
              </span>
              <h2 className="font-serif text-lg font-bold">My Posts</h2>
            </div>
            <Link
              href="/submit"
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              <span aria-hidden="true" className="text-base leading-none">+</span>
              Create Post
            </Link>
          </div>

          <SortBar value={sort} onChange={setSort} />
          {posts.length === 0 && (
            <p className="rounded-card border border-border bg-card p-5 text-sm text-muted-foreground">
              No posts to show yet.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard
                key={`${profile.id}:${post.id}`}
                post={post}
                profile={profile}
                onDelete={(id) =>
                  setMyPosts((items) =>
                    items.filter((item) => item.id !== id)
                  )
                }
                onLike={(id, value) =>
                  setMyPosts((items) =>
                    items.map((item) =>
                      item.id === id ? { ...item, ...value } : item
                    )
                  )
                }
              />
            ))}
          </div>
        </div>

        <JoinedCommunitiesCard />
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setProfile(updated);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}
