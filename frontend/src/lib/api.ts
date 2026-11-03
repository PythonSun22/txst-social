import { getSupabase } from "./supabase";

/** Call FastAPI using the current Supabase session. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  publicRead = false
): Promise<T> {
  const { data, error } = await getSupabase().auth.getSession();

  if (error) throw error;
  if (!data.session && !publicRead) {
    throw new Error("Sign in to perform this action.");
  }

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const headers = new Headers(init.headers);

  if (data.session) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  // Let the browser supply the boundary for multipart image uploads.
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${response.status}). Please try again.`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Public fields returned for a search result or a follower/following row. */
export interface ProfileListItem {
  id: string;
  username: string;
  display_name: string | null;
  major: string | null;
}

/** Public profile data plus the viewer-specific follow state. */
export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  major: string | null;
  major_id: string | null;
  student_level: string | null;
  profile_image_url: string | null;
  profile_image_upload_id: string | null;
  banner_image_upload_id: string | null;
  home_college_id: string | null;
  post_karma: number;
  comment_karma: number;
  follower_count: number;
  following_count: number;
  is_following: boolean;
}

export interface UserFollowResult {
  following: boolean;
  follower_count: number;
}

/** Search active public profiles by username or display name. */
export const searchProfiles = (query: string, signal?: AbortSignal) =>
  apiRequest<ProfileListItem[]>(
    `/profiles/search?q=${encodeURIComponent(query)}`,
    { signal },
    true
  );

/** Retrieve a public profile and its viewer-specific follow state. */
export const getPublicProfile = (id: string, signal?: AbortSignal) =>
  apiRequest<PublicProfile>(`/profiles/${encodeURIComponent(id)}`, { signal }, true);

/** Retrieve the public student list for one side of a profile's connections. */
export const getProfileConnections = (
  id: string,
  kind: "followers" | "following",
  signal?: AbortSignal
) =>
  apiRequest<ProfileListItem[]>(
    `/profiles/${encodeURIComponent(id)}/${kind}`,
    { signal },
    true
  );

/** Follow or unfollow a student through FastAPI. */
export const setUserFollow = (id: string, following: boolean) =>
  apiRequest<UserFollowResult>(
    `/profiles/${encodeURIComponent(id)}/follow`,
    { method: following ? "PUT" : "DELETE" }
  );
