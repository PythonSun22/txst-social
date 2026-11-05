"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPublicProfile, setUserFollow } from "@/lib/api";
import { getCurrentProfile, type CurrentProfile, type ProfileDetails } from "@/lib/profiles";
import { getMyPosts, getUserPosts, type FeedPost } from "@/lib/posts";
import { getSupabase } from "@/lib/supabase";
import EditProfileModal from "./EditProfileModal";
import ProfileView from "./ProfileView";
import ImageProcessingNotice from "@/components/images/ImageProcessingNotice";

interface LoadedProfile {
  profile: ProfileDetails;
  viewer: CurrentProfile | null;
  owner: CurrentProfile | null;
  following: boolean;
}

/** Omit profileId for the current account; public links keep /profile/[id]. */
export default function ProfileContainer({ profileId }: { profileId?: string }) {
  return <ProfileContent key={profileId ?? "own-profile"} profileId={profileId} />;
}

function ProfileContent({ profileId }: { profileId?: string }) {
  const router = useRouter();
  const [data, setData] = useState<LoadedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [revision, setRevision] = useState(0);
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    async function load() {
      request?.abort();
      request = new AbortController();
      const current = request;
      mutation.current?.abort();
      mutation.current = null;
      setData(null); setPosts([]); setLoading(true); setPostsLoading(true);
      setError(""); setPostsError(""); setActionError(""); setEditing(false); setFollowing(false);
      let redirecting = false;
      try {
        const viewer = await getCurrentProfile(current.signal).catch((cause) => {
          if (!profileId) throw cause;
          return null;
        });
        if (!active || current.signal.aborted) return;
        if (profileId && viewer?.id === profileId) {
          redirecting = true;
          router.replace("/profile");
          return;
        }
        if (!profileId && viewer && !viewer.username_chosen) {
          redirecting = true;
          router.replace("/choose-username");
          return;
        }
        const publicProfile = profileId ? await getPublicProfile(profileId, current.signal) : null;
        if (!active || current.signal.aborted) return;
        const profile = publicProfile ?? viewer;
        if (!profile) return;
        setData({ profile, viewer, owner: profileId ? null : viewer, following: publicProfile?.is_following ?? false });
        setLoading(false);
        try {
          const items = profileId ? await getUserPosts(profile.id, current.signal) : await getMyPosts(current.signal);
          if (active && !current.signal.aborted) setPosts(items);
        } catch (cause) {
          if (active && !current.signal.aborted) setPostsError(cause instanceof Error ? cause.message : "Unable to load posts.");
        }
      } catch (cause) {
        if (active && !current.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load this profile.");
      } finally {
        if (active && !current.signal.aborted && !redirecting) { setLoading(false); setPostsLoading(false); }
      }
    }
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabase().auth.onAuthStateChange(() => {
        queueMicrotask(() => { if (active) void load(); });
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void load();
    } catch (cause) {
      queueMicrotask(() => {
        if (active) { setError(cause instanceof Error ? cause.message : "Unable to load this profile."); setLoading(false); }
      });
    }
    return () => { active = false; request?.abort(); mutation.current?.abort(); mutation.current = null; unsubscribe?.(); };
  }, [profileId, revision, router]);

  const updateOwner = useCallback((updated: CurrentProfile) => {
    setData((current) => current?.owner?.id === updated.id
      ? { ...current, profile: updated, owner: updated, viewer: updated } : current);
  }, []);
  const refreshOwner = useCallback(async (signal: AbortSignal) => {
    const updated = await getCurrentProfile(signal);
    if (!signal.aborted && updated) updateOwner(updated);
  }, [updateOwner]);
  const updateStatus = useCallback((id: string, status: FeedPost["status"], failed: boolean) => {
    setPosts((items) => items.map((post) => post.id === id ? { ...post, status, moderation_failed: failed } : post));
  }, []);
  const updateLike = useCallback((id: string, value: { liked: boolean; like_count: number }) => {
    setPosts((items) => items.map((post) => post.id === id ? { ...post, ...value } : post));
  }, []);
  const removePost = useCallback((id: string) => setPosts((items) => items.filter((post) => post.id !== id)), []);

  async function toggleFollow() {
    if (!data?.viewer?.email_verified || data.owner || mutation.current) return;
    const request = new AbortController();
    mutation.current = request;
    setFollowing(true); setActionError("");
    try {
      const result = await setUserFollow(data.profile.id, !data.following, request.signal);
      if (!request.signal.aborted) setData((current) => current ? {
        ...current, following: result.following,
        profile: { ...current.profile, follower_count: result.follower_count },
      } : current);
    } catch (cause) {
      if (!request.signal.aborted) setActionError(cause instanceof Error ? cause.message : "Unable to update follow status.");
    } finally {
      if (mutation.current === request) { mutation.current = null; setFollowing(false); }
    }
  }

  async function signOut() {
    setSigningOut(true); setActionError("");
    try {
      const { error } = await getSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      setData(null); setPosts([]); setEditing(false);
      router.replace("/login");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Sign-out failed. Please try again.");
    } finally { setSigningOut(false); }
  }

  if (loading) return <p role="status">Loading profile…</p>;
  if (error) return <p role="alert" className="text-primary">{error} <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Reload profile</button></p>;
  if (!data) return <p>Please <Link href="/login" className="text-primary underline">sign in</Link> to view your profile.</p>;
  const { owner, viewer, profile } = data;
  const actions = owner ? <>
    <button type="button" onClick={() => setEditing(true)} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90">Edit Profile</button>
    <button type="button" onClick={() => void signOut()} disabled={signingOut}
      className="ml-auto shrink-0 rounded-full border border-primary/30 px-4 py-2 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">
      {signingOut ? "Signing out..." : "Sign Out"}
    </button>
  </> : viewer?.email_verified ? <button type="button" disabled={following} onClick={() => void toggleFollow()}
    className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50">
    {following ? "Saving…" : data.following ? "Unfollow" : "Follow"}
  </button> : viewer ? <span className="text-sm text-muted-foreground">Verify your email to follow students.</span>
    : <Link href="/login" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">Sign in to follow</Link>;

  return <>
    <ProfileView profile={profile} viewer={viewer} isOwn={!!owner} posts={posts} postsLoading={postsLoading}
      postsError={postsError} onRetry={() => setRevision((value) => value + 1)} actions={actions} actionError={actionError}
      onStatus={updateStatus} onLike={updateLike} onDelete={removePost}
      notices={owner && (owner.pending_profile_image_upload_id || owner.pending_banner_image_upload_id) && (
        <div role="status" className="rounded-card border border-border bg-card p-3 text-sm">
          {owner.pending_profile_image_upload_id && <ImageProcessingNotice id={owner.pending_profile_image_upload_id} label="Profile photo" onProcessed={refreshOwner} />}
          {owner.pending_banner_image_upload_id && <ImageProcessingNotice id={owner.pending_banner_image_upload_id} label="Banner" onProcessed={refreshOwner} />}
        </div>
      )} />
    {owner && editing && <EditProfileModal profile={owner} onClose={() => setEditing(false)}
      onSaved={(updated) => { updateOwner(updated); setEditing(false); }} />}
  </>;
}
