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

export interface CurrentProfile {
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
  pending_profile_image_upload_id: string | null;
  pending_banner_image_upload_id: string | null;
  profile_image_status: string | null;
  banner_image_status: string | null;
  home_college_id: string | null;
  home_college: HomeCollege | null;
  post_karma: number;
  comment_karma: number;
  followed_space_count: number;
  joined_community_count: number;
  email_verified: boolean;
}

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
