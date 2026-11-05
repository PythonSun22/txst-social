import { apiRequest } from "./api";
import { getSupabase } from "./supabase";

export interface HomeCollege {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  accent_hex: string | null;
  crest_key: string | null;
}

export type StudentLevel =
  | "freshman"
  | "sophomore"
  | "junior"
  | "senior"
  | "graduate";

/** Display-safe data shared by own and public profile views. */
export interface ProfileDetails {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  major: string | null;
  major_id: string | null;
  student_level: StudentLevel | null;
  profile_image_url: string | null;
  profile_image_upload_id: string | null;
  banner_image_upload_id: string | null;
  home_college_id: string | null;
  home_college: HomeCollege | null;
  post_karma: number;
  comment_karma: number;
  followed_space_count: number;
  joined_community_count: number;
  follower_count: number;
  following_count: number;
}

export interface CurrentProfile extends ProfileDetails {
  email_verified: boolean;
  username_chosen: boolean;
  pending_profile_image_upload_id: string | null;
  pending_banner_image_upload_id: string | null;
  profile_image_status: string | null;
  banner_image_status: string | null;
}

export const profileImagePath = (id: string, variant: "avatar_large" | "banner", ownProfile: boolean) =>
  `/images/${encodeURIComponent(id)}/${ownProfile ? "preview" : "published-preview"}?variant=${variant}`;

export const getProfileImage = (id: string, variant: "avatar_large" | "banner", ownProfile: boolean, signal?: AbortSignal) =>
  apiRequest<{ url: string }>(profileImagePath(id, variant, ownProfile), { signal }, !ownProfile);

export interface MajorOption {
  id: string;
  name: string;
  degree: string;
  college_id: string;
}

export interface ProfileOptions {
  colleges: HomeCollege[];
  majors: MajorOption[];
  student_levels: StudentLevel[];
}

export interface ProfileUpdate {
  display_name: string | null;
  bio: string | null;
  major_id: string | null;
  home_college_id: string | null;
  student_level: StudentLevel | null;
  profile_image_upload_id: string | null;
  banner_image_upload_id: string | null;
}

export async function getCurrentProfile(
  signal?: AbortSignal
): Promise<CurrentProfile | null> {
  const { data, error } = await getSupabase().auth.getSession();

  if (error) throw error;
  if (!data.session) return null;

  return apiRequest<CurrentProfile>("/auth/me", { signal });
}

export const getProfileOptions = (signal?: AbortSignal) =>
  apiRequest<ProfileOptions>("/profile/options", { signal });

export const updateCurrentProfile = (updates: ProfileUpdate) =>
  apiRequest<CurrentProfile>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });

/** Choose the account's one permanent public username (FR-06). */
export const chooseUsername = (username: string) =>
  apiRequest<CurrentProfile>("/auth/me/username", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
