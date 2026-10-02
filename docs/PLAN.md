# PLAN.md

Working plan for the current sprint. **Not fixed** — we revise this as we go.
The full semester breakdown lives in `docs/Two_Week_Sprint_Timeline.md`.

Read `AGENTS.md` and `supabase/migrations/20260910200000_lynx_core.sql` before
starting. Cite `FR-` numbers (top of that migration) in commits and PRs.

---

## Comments (`feature/comments` branch)

Registration, posts (text/image), likes, and moderation (on a separate
unmerged branch) are done. Comments are the next big product gap: the
`comments`/`comment_likes` tables and `Comment`/`CommentLike` models already
exist (materialized `ltree` path, per `[D-3]`), but there is no router, no
endpoint, and no UI — `PostCard` shows a comment count with nothing behind it.

**Relevant FRs:** FR-02 (verified email gates commenting), FR-35 (one indexed
query reads a whole thread via `path`), FR-36 (`posts.comment_count` is a
denormalized cache, written in the same transaction), FR-41 (depth limit,
UI must support at least 8 levels), FR-43 (soft delete), FR-45/FR-50/FR-51
(comment likes — upvote only, same as posts), FR-90 (screening — see below).

**Interim moderation stance:** the moderation worker lives on an unmerged
branch (`moderation_setup`) and does not exist here. On `dev`, `posts.py`'s
actual visibility rule (`visible_to()`) is `approved` **or the caller's own**
— confirmed by testing, not assumed — so a `pending` post from someone else
is invisible to everyone but its author until moderation merges, exactly as
FR-90 intends. (`Post.status.in_(["approved", "pending"])` only appears in
`GET /posts/me`, already scoped to the caller's own posts — it is not a
general exception.) Comments mirror this exact rule: `pending` is visible
only to its author, same as posts.

### Steps

1. **`backend/comment_schemas.py`** — `CommentCreate` (`body`, optional
   `parent_id`), `CommentResponse`, `CommentThreadResponse`. Mirror
   `post_schemas.py`'s style (`ConfigDict(extra="forbid")`, etc.).
2. **`backend/comments.py`** — new router:
   - `GET /posts/{post_id}/comments` — full thread, ordered by `path`
     (one query, no recursion, per `[D-3]`). Same `pending`-is-visible
     interim rule as posts; `deleted_at` tombstones excluded.
   - `POST /posts/{post_id}/comments` — `require_verified_profile`, ban
     check (reuse `check_ban` from `posts.py`), compute the new row's
     `path`/`depth` from the parent (top-level if `parent_id` is `None`),
     enforce the depth constraint, bump `posts.comment_count` atomically in
     the same transaction.
   - `PUT`/`DELETE /posts/{post_id}/comments/{comment_id}/like` — mirrors
     `set_like` in `posts.py`; updates `comment_karma`, not `post_karma`.
   - `DELETE /posts/{post_id}/comments/{comment_id}` — soft-delete own
     comment, mirroring `delete_own_post` (FR-43).
3. **`GET /posts/{post_id}`** — doesn't exist yet; needed for a post detail
   page. Reuse `load_visible_post` + `serialize_posts`.
4. Wire `comments_router` into `main.py`.
5. **Frontend:** `lib/comments.ts` (mirrors `lib/posts.ts`), a post detail
   page at `frontend/src/app/posts/[id]/page.tsx`, a `CommentThread`/
   `CommentItem` component (indent by `depth`, reply box per comment, a
   top-level composer). Link `PostCard`'s comment count to the detail page.
6. Manual verification: post a comment, reply to a reply (depth > 1, confirm
   ordering), like/unlike, delete own comment, confirm `comment_count` on
   the post stays correct throughout.

### Non-goals (this pass)

- No moderation worker integration for comments — see interim stance above.
- No comment editing (`edited_at` exists in the schema; building the edit
  flow is separate work).
- No reports on comments (FR-97–99 — already deferred project-wide).
- No thread collapsing, lazy-loading, or virtualization for huge threads —
  render the full thread per load; fine at this project's scale.
- No changes to post likes/posts.py beyond adding `GET /posts/{post_id}` and
  exporting `check_ban`/`load_visible_post` if needed for reuse.

_Revise this file whenever the plan changes. Keep it short._
