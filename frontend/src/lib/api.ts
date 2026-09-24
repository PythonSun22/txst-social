import { getSupabase } from "./supabase";

export interface CurrentProfile {
  id: string;
  username: string;
  display_name: string | null;
  email_verified: boolean;
}

  return response.json() as Promise<T>;
/** Call FastAPI with the current Supabase session; application data stays behind the API. */
export async function apiRequest<T>(path: string, init: RequestInit = {}, publicRead = false): Promise<T> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (!data.session && !publicRead) throw new Error("Sign in to perform this action.");
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `Request failed (${response.status}). Please try again.`);
  if (response.status === 204) return undefined as T;
  }
}

  const { data, error } = await getSupabase().auth.getSession();

  if (error) throw error;
  if (!data.session && !publicRead) {
    throw new Error("Sign in to perform this action.");
  }

  const base =
    process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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

  const response = await fetch(
    `${base.replace(/\/$/, "")}${path}`,
    {
      ...init,
      headers,
      cache: "no-store",
    }
  );

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

export async function getCurrentProfile(
  signal?: AbortSignal
): Promise<CurrentProfile | null> {
  const { data, error } = await getSupabase().auth.getSession();

  if (error) throw error;
  if (!data.session) return null;

  return apiRequest<CurrentProfile>("/auth/me", { signal });
}
