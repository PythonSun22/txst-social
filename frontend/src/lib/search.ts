import { apiRequest } from "./api";
import type { FeedPage } from "./posts";

/** Search post titles (FR-80). Results reuse the feed's shape and cursor, so they render with `PostCard`. */
export const searchPosts = (q: string, cursor?: string, signal?: AbortSignal) => {
  const params = new URLSearchParams({ q });
  if (cursor) params.set("cursor", cursor);
  return apiRequest<FeedPage>(`/search/posts?${params}`, { signal }, true);
};
