import { getSupabase } from "./supabase";

export interface CurrentProfile {
  id: string;
  username: string;
  display_name: string | null;
  email_verified: boolean;
}

export async function getCurrentProfile(signal?: AbortSignal): Promise<CurrentProfile | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${base.replace(/\/$/, "")}/auth/me`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Unable to load your account.");
  }
  return response.json();
}
