"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UserConnections from "@/components/UserConnections";
import PostCard from "@/components/posts/PostCard";
import { useParams, useRouter } from "next/navigation";
import {
  getPublicProfile,
  setUserFollow,
  type PublicProfile,
} from "@/lib/api";
import { getCurrentProfile, getProfileOptions, type CurrentProfile, type HomeCollege } from "@/lib/profiles";
import { getUserPosts, type FeedPost } from "@/lib/posts";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [collegeOptions, setCollegeOptions] = useState<HomeCollege[]>([]);
  const [viewer, setViewer] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");

  const refresh = useCallback(async () => {
    const [publicProfile, currentProfile] = await Promise.all([
      getPublicProfile(id), getCurrentProfile().catch(() => null),
    ]);
    setProfile(publicProfile);
    setViewer(currentProfile);
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPostsLoading(true);
    setPostsError("");
    setPosts([]);
    Promise.all([
      getPublicProfile(id),
      getCurrentProfile().catch(() => null),
      getUserPosts(id).then((items) => ({ items, error: "" })).catch((cause) => ({
        items: [] as FeedPost[],
        error: cause instanceof Error ? cause.message : "Unable to load this student's posts.",
      })),
    ])
      .then(([publicProfile, currentProfile, userPosts]) => {
        if (active) {
          setProfile(publicProfile);
          setViewer(currentProfile);
          setPosts(userPosts.items);
          setPostsError(userPosts.error);
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this profile."); })
      .finally(() => { if (active) { setLoading(false); setPostsLoading(false); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!profile?.home_college_id) return;
    let active = true;
    getProfileOptions()
      .then((options) => { if (active) setCollegeOptions(options.colleges); })
      .catch(() => { if (active) setCollegeOptions([]); });
    return () => { active = false; };
  }, [profile?.home_college_id]);

  useEffect(() => {
    if (!loading && profile && viewer?.id === profile.id) {
      router.replace("/profile");
    }
  }, [loading, profile, router, viewer]);

  async function toggleFollow() {
    if (!profile || busy) return;
    setBusy(true);
    setError("");
    try {
      await setUserFollow(profile.id, !profile.is_following);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update follow status.");
    } finally { setBusy(false); }
  }

  if (loading) return <p role="status">Loading profile…</p>;
  if (error && !profile) return <p role="alert" className="text-primary">{error}</p>;
  if (!profile) return <p role="alert">Profile not found.</p>;
  if (viewer?.id === profile.id) return <p role="status">Opening your profile…</p>;

  const name = profile.display_name || profile.username;
  const homeCollege = collegeOptions.find((college) => college.id === profile.home_college_id);
  return <section className="mx-auto max-w-4xl space-y-5">
    <article className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      <div className="h-32 bg-primary" />
      <div className="px-6 pb-6">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-accent font-serif text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 pb-1">
            <h1 className="font-serif text-2xl font-bold text-primary">{name}</h1>
            {viewer?.email_verified && <button type="button" disabled={busy} onClick={() => void toggleFollow()} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
              {busy ? "Saving…" : profile.is_following ? "Unfollow" : "Follow"}
            </button>}
            {!viewer && <Link href="/login" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">Sign in to follow</Link>}
            {viewer && !viewer.email_verified && <span className="text-sm text-muted-foreground">Verify your email to follow students.</span>}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">@{profile.username}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{profile.bio || "No bio added yet."}</p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <div><dt className="sr-only">Major</dt><dd>{profile.major || "Major not specified"}</dd></div>
          <div><dt className="sr-only">Student level</dt><dd className="capitalize">{profile.student_level || "Level not specified"}</dd></div>
          <div><dt className="sr-only">Home college</dt><dd>{homeCollege?.short_name || homeCollege?.name || (profile.home_college_id ? "College unavailable" : "College not selected")}</dd></div>
        </dl>
        <UserConnections profileId={profile.id} followerCount={profile.follower_count} followingCount={profile.following_count} />
      </div>
    </article>
    {error && <p role="alert" className="text-sm text-primary">{error}</p>}
    <section className="space-y-3" aria-labelledby="student-posts-heading">
      <h2 id="student-posts-heading" className="font-serif text-xl font-bold text-primary">{name}&apos;s Posts</h2>
      {postsLoading && <p role="status" className="text-sm text-muted-foreground">Loading posts…</p>}
      {postsError && <p role="alert" className="text-sm text-primary">{postsError}</p>}
      {!postsLoading && !postsError && posts.length === 0 && <p className="rounded-card border border-border bg-card p-5 text-sm text-muted-foreground">No public posts yet.</p>}
      {posts.map((post) => <PostCard
        key={`${viewer?.id ?? "guest"}:${post.id}`}
        post={post}
        profile={viewer}
        onDelete={(postId) => setPosts((items) => items.filter((item) => item.id !== postId))}
        onLike={(postId, value) => setPosts((items) => items.map((item) => item.id === postId ? { ...item, ...value } : item))}
        onStatus={() => undefined}
      />)}
    </section>
  </section>;
}
