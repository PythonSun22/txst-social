"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UserConnections from "@/components/UserConnections";
import { useParams } from "next/navigation";
import {
  getCurrentProfile,
  getPublicProfile,
  setUserFollow,
  type CurrentProfile,
  type PublicProfile,
} from "@/lib/api";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [viewer, setViewer] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    Promise.all([getPublicProfile(id), getCurrentProfile().catch(() => null)])
      .then(([publicProfile, currentProfile]) => {
        if (active) { setProfile(publicProfile); setViewer(currentProfile); }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

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
  if (viewer?.id === profile.id) return <p>This is your profile. <Link className="text-primary underline" href="/profile">Open your profile</Link></p>;

  const name = profile.display_name || profile.username;
  return <section className="mx-auto max-w-4xl space-y-5">
    <article className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      <div className="h-32 bg-primary" />
      <div className="px-6 pb-6">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-accent font-serif text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 pb-1">
            <h1 className="font-serif text-2xl font-bold text-primary">{name}</h1>
            {viewer?.email_verified && <button type="button" disabled={busy} onClick={() => void toggleFollow()} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
              {busy ? "Saving…" : profile.is_following ? "Following" : "Follow"}
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
          <div><dt className="sr-only">Home college</dt><dd>{profile.home_college?.short_name || "College not selected"}</dd></div>
        </dl>
        <UserConnections profileId={profile.id} followerCount={profile.follower_count} followingCount={profile.following_count} />
      </div>
    </article>
    {error && <p role="alert" className="text-sm text-primary">{error}</p>}
  </section>;
}
