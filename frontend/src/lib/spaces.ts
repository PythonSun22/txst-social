import { apiRequest } from "./api";
import { colleges } from "./colleges";

export interface Space {
  id: string;
  slug: string;
  name: string;
  description: string;
  rules: string;
  kind: "college" | "community";
  follower_count: number;
  is_following: boolean;
}

export const spaceHref = (slug: string) => slug === "general" ? "/"
  : `/${colleges.some((college) => college.slug === slug) ? "colleges" : "spaces"}/${encodeURIComponent(slug)}`;

export const listSpaces = (signal?: AbortSignal) => apiRequest<Space[]>("/spaces", { signal }, true);
export const getSpace = (slug: string, signal?: AbortSignal) =>
  apiRequest<Space>(`/spaces/${encodeURIComponent(slug)}`, { signal }, true);
export const getProfileSpaces = (id: string, signal?: AbortSignal) =>
  apiRequest<Space[]>(`/profiles/${encodeURIComponent(id)}/spaces`, { signal }, true);
export const setSpaceFollow = (slug: string, following: boolean, signal?: AbortSignal) =>
  apiRequest<{ following: boolean; follower_count: number }>(`/spaces/${encodeURIComponent(slug)}/follow`,
    { method: following ? "PUT" : "DELETE", signal });
