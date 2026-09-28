import { apiRequest } from "./api";
export interface FeedPost {
  id: string; author: string; title: string; body: string | null; url: string | null;
  type: "text" | "image" | "link";
  status: "pending" | "approved" | "blocked" | "removed";
  moderation_failed: boolean;
  created_at: string; like_count: number; comment_count: number; liked: boolean;
  media: { position: number; width: number | null; height: number | null }[];
}
export interface FeedPage { items: FeedPost[]; next_cursor: string | null }
export const fetchPosts = (cursor?: string, signal?: AbortSignal) => apiRequest<FeedPage>(
  `/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }, true,
);
export const createPost = (payload: { submission_id: string; title: string; body: string | null; image_ids: string[] }) =>
  apiRequest<FeedPost>("/posts", { method: "POST", body: JSON.stringify(payload) });
export const fetchPost = (id: string, signal?: AbortSignal) =>
  apiRequest<FeedPost>(`/posts/${id}`, { signal }, true);
export const setPostLike = (id: string, liked: boolean) => apiRequest<{ liked: boolean; like_count: number }>(
  `/posts/${id}/like`, { method: liked ? "PUT" : "DELETE" },
);
export const getPostImage = (id: string, position: number, signal?: AbortSignal) =>
  apiRequest<{ url: string }>(`/posts/${id}/media/${position}/preview`, { signal }, true);
