import { apiRequest } from "./api";

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author: string;
  can_delete: boolean;
  body: string | null;
  depth: number;
  status: "pending" | "approved" | "blocked" | "removed";
  created_at: string;
  like_count: number;
  liked: boolean;
}

export interface CommentThread { items: Comment[] }

export const fetchComments = (postId: string, signal?: AbortSignal) =>
  apiRequest<CommentThread>(`/posts/${postId}/comments`, { signal }, true);

export const createComment = (postId: string, payload: { body: string; parent_id?: string | null }) =>
  apiRequest<Comment>(`/posts/${postId}/comments`, { method: "POST", body: JSON.stringify(payload) });

export const setCommentLike = (postId: string, commentId: string, liked: boolean) =>
  apiRequest<{ liked: boolean; like_count: number }>(
    `/posts/${postId}/comments/${commentId}/like`, { method: liked ? "PUT" : "DELETE" },
  );

export const deleteComment = (postId: string, commentId: string) =>
  apiRequest<void>(`/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
