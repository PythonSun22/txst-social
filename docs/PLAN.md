# PLAN.md

Working plan for the current sprint. **Not fixed** — we revise this as we go.
The full semester breakdown lives in `docs/Two_Week_Sprint_Timeline.md`.

Read `AGENTS.md` and `supabase/migrations/20260910200000_lynx_core.sql` before
starting. Cite `FR-` numbers (top of that migration) in commits and PRs.

---

## Basic post search (`feature/search`, FR-80)

Sprint 5 asks to "begin basic search". The core migration already maintains
`posts.search_vector` (a generated `tsvector` over the title) with a GIN index,
so this pass is an endpoint and a page — no schema change.

### Steps

1. **`backend/search.py`** — new router with `GET /search/posts?q=&cursor=&limit=`.
   Parse `q` with `websearch_to_tsquery('english', …)` so user input can never
   be a syntax error. Apply the same `visible_to()` rule as the feed (approved,
   or the caller's own pending post); exclude tombstoned posts and spaces.
   Search every space, not only General, so college posts appear once they exist.
2. Order newest first and reuse the feed's `(created_at, id)` cursor, so paging
   is stable (FR-66) and shares one tested implementation.
3. Return the existing `FeedResponse`, so results render with `PostCard`.
4. Wire `search_router` into `main.py`; add offline tests in
   `backend/tests/test_search.py` mirroring `test_posts.py`.
5. **Frontend:** `lib/search.ts`, a `/search?q=` page (results + Load more),
   and a `PostSearch` box above the ForAll feed and on the results page. The
   navbar is kept free for a future site-wide search.
6. Update README endpoints, AGENTS.md §7 and CLAUDE.md status.

**Constraints:** No migration. Same visibility rule as the feed — search must
never reveal a pending/blocked post to anyone but its author. Query length
capped at 100 characters.

**Non-goals (this pass):** Searching post bodies (needs a migration to widen
`search_vector`), space-name search (FR-80, wait for the colleges work),
comment search (FR-81), relevance ranking, prefix/typo matching
("calc" will not match "calculus"), and search-as-you-type.

---

## Moderation (FR-32, FR-60, FR-90–92)

### Multiple-image screening (FR-32, FR-90–92)

Implemented and verified offline: 70 backend tests passed; 13 database
integration tests skipped. Live Storage/provider validation remains outstanding.

1. Screen each ordered attachment in its own request with the post title/body;
   retain the single text request for posts without images.
2. Combine category flags with OR and scores with maximums. Approve only after
   every attachment passes; stop and block on a flagged attachment. A failed
   check before a blocking verdict leaves the entire post pending for retry.
3. Preserve each checked attachment's position, signals, model and latency in
   the existing JSON audit, without signed URLs. Keep atomic publication,
   content hashes, retry limits and expired-lease rejection.
4. Add offline provider/worker regression tests for 1–10 images, later-image
   flags and failures, invalid responses, and audit privacy; update feature docs.

**Constraints:** Sequential requests, no partial approval, and no automatic
retry of exhausted posts. The existing five-minute worker lease remains the
publication deadline; each provider request retains its ten-second network
timeout and no SDK retries.
**Non-goals:** Schema/configuration changes, live provider or shared database
operations, local loopback image handoff, frontend changes, and retry tooling.

### Remaining moderation work

General/ForAll posts start private and pending. The opt-in worker screens them
and publishes only an approved result; failed screening retries with a limit.
A separate, disabled-by-default local text recheck is being evaluated for
contextual false positives. Comments and user reports are later work.

1. Evaluate the contextual rule on representative, independently labeled posts
   before considering it for a shared environment.
2. Resolve local image-screening handoff and verify the full post flow locally.
3. Coordinate the moderation migration with the team after review, before
   enabling the worker against the shared database.

**Constraints:** No shared database changes before review and coordination.
Unscreened posts stay private, and this feed has no human-review dependency.
The detailed workflow, local recheck plans, results, and limitations live in
[moderation.md](moderation.md).

---

## Registration (`Signup` branch)

Registration, posts (text/image), likes, and moderation (on a separate
unmerged branch) are done. Comments are the next big product gap: the
`comments`/`comment_likes` tables and `Comment`/`CommentLike` models already
exist (materialized `ltree` path, per `[D-3]`), but there is no router, no
endpoint, and no UI — `PostCard` shows a comment count with nothing behind it.

**Relevant FRs:** FR-02 (verified email gates commenting), FR-35 (one indexed
query reads a whole thread via `path`), FR-36 (`posts.comment_count` is a
denormalized cache, written in the same transaction), FR-41 (depth limit,
UI must support at least 8 levels), FR-43 (soft delete), FR-45/FR-50/FR-51
(comment likes — upvote only, same as posts), FR-90 (screening applies to posts only — see below).

**Moderation stance:** comments are **not screened**. They are created
`approved` and are visible to everyone immediately. The ForAll worker screens
posts only (FR-90–92). Comments use the same read rule as `posts/routes.py`'s
`visible_to()` — `approved` or the caller's own — so a comment later set to
`blocked`/`removed` (FR-93) is hidden from others.

### Steps

1. **`backend/comments/schemas.py`** — `CommentCreate` (`body`, optional
   `parent_id`), `CommentResponse`, `CommentThreadResponse`. Mirror
   `posts/schemas.py`'s style (`ConfigDict(extra="forbid")`, etc.).
2. **`backend/comments/routes.py`** — new router:
   - `GET /posts/{post_id}/comments` — full thread, ordered by `path`
     (one query, no recursion, per `[D-3]`). Same `approved`-or-own
     read rule as posts; `deleted_at` tombstones excluded.
   - `POST /posts/{post_id}/comments` — `require_verified_profile`, ban
     check (reuse `check_ban` from `posts/routes.py`), compute the new row's
     `path`/`depth` from the parent (top-level if `parent_id` is `None`),
     enforce the depth constraint, bump `posts.comment_count` atomically in
     the same transaction.
   - `PUT`/`DELETE /posts/{post_id}/comments/{comment_id}/like` — mirrors
     `set_like` in `posts/routes.py`; updates `comment_karma`, not `post_karma`.
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

- No classifier screening for comments — see moderation stance above.
- No comment editing (`edited_at` exists in the schema; building the edit
  flow is separate work).
- No reports on comments (FR-97–99 — already deferred project-wide).
- No thread collapsing, lazy-loading, or virtualization for huge threads —
  render the full thread per load; fine at this project's scale.
- No changes to post likes/posts/routes.py beyond adding `GET /posts/{post_id}` and
  exporting `check_ban`/`load_visible_post` if needed for reuse.

---

## Earlier post milestone (historical plan)

This sequence records the earlier post slice; consult current feature docs for
implementation status.

1. General-only retrieval and authenticated text creation (FR-30, FR-60),
   including per-space bans (FR-95). Derive authors from the verified
   profile. New posts stay pending and are visible to their author (FR-90).
2. Add ordered `post_media`, migrate existing image keys, then private
   Storage uploads and an image-capable composer/card (FR-31, FR-32).
   Required titles remain; support text only, images only, and text plus
   images.
3. Verify persistence after refresh and pending-media isolation across
   accounts.

The earlier post plan predates automatic moderation; see [moderation.md](moderation.md)
for the current screening workflow.
Comments, persistent likes, advanced ranking, and gallery features are
outside this slice.

_Revise this file whenever the plan changes. Keep it short._
