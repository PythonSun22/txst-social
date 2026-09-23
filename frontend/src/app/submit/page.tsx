"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PostComposer from "@/components/PostComposer";
import { getCurrentProfile, type CurrentProfile } from "@/lib/api";

/**
 * Create-post page, reached from the "Create Post" button on the feed.
 *
 * Only signed-in students with a verified email may post (FR-02); the backend
 * will enforce this too; checking here just avoids showing a form that can't work.
 */
export default function SubmitPage() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getCurrentProfile(controller.signal)
      .then(setProfile)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load your account.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <section>
      <h1 className="mb-3 font-serif text-xl font-bold text-primary">Create a post</h1>

      {loading && <p role="status">Loading your account…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && !profile && (
        <p>
          You need to{" "}
          <Link href="/login" className="font-bold text-primary underline">
            sign in
          </Link>{" "}
          to post.
        </p>
      )}

      {profile && !profile.email_verified && <p>Verify your Texas State email before posting.</p>}

      {profile?.email_verified && <PostComposer />}
    </section>
  );
}
