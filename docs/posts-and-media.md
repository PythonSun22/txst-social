# Persistent posts and reusable images

The General/ForAll feed now reads database posts, newest first. `/submit` saves
a required title with text, images, or both (FR-30/31/32/60). New posts are
`pending` and visible only to their author (FR-90). Classifier integration and
timeout decision [D-4] remain deferred; saving or uploading never approves content.

## Module boundaries for contributors and agents

| Layer | Files | Contract |
|---|---|---|
| Image validation | `frontend/src/lib/images/image-policy.ts`, `image-file.ts` | Inspect a `File`; return `SelectedImage` with dimensions, errors and a local preview URL. Policy comes from FastAPI. |
| Browser editing | `image-edit.ts`, `components/ImageEditor.tsx` | Work on a local selection. Save exports and revalidates a new `File`; Discard preserves the selection. No network or post knowledge. |
| Selection UI | `components/ImageUploader.tsx` | Default mode transfers one image and calls `onUploaded(SavedImage)`. `selectOnly` mode calls `onSelected(SelectedImage \| null)` and leaves transfers to its caller. |
| Image transfer | `lib/images/image-api.ts` | `uploadImage` reserves metadata, transfers directly to private Storage, then confirms completion. Returns `SavedImage`; never creates a post. |
| Post orchestration | `components/PostComposer.tsx`, `lib/posts.ts` | Own title, body, attachment order and submission retry ID. Upload selected files, then send completed image IDs to `/posts`. |
| Image API | `backend/images.py`, `image_storage.py`, `image_schemas.py` | Own upload policy, authorization, reservations, completion and Storage signing. |
| Post API | `backend/posts.py`, `post_schemas.py` | Validate content, derive author from Auth, check bans and attachment ownership/completion, save post and ordered references atomically. |
| Feed presentation | `app/page.tsx`, `components/PostCard.tsx` | Fetch chronological pages, authorized image previews and persistent likes. No mock post data. |

For another image use case (for example a community cover), reuse the selector,
editor and transfer functions. Add that feature's own association and permission
checks. Do not add post IDs or post creation calls to the image modules. These
modules accept images only; supporting other file types requires a separate
policy and validation path. The existing bucket name `post-images` is a storage
detail, not a post foreign key on an upload.

`ImageUploader` owns its preview URLs and revokes them on replacement/unmount.
Its parent must not revoke those URLs. `onSelected(null)` means validation or
editing is in progress, or the selection is invalid; disable submission until a
valid selection arrives. The component renders a `div`, so it can live inside
the composition form without nested HTML forms. `disabled` blocks selection
during submission. `/upload-test` continues exercising standalone upload mode.

## Data and API contracts

Migration `20260924205639_persistent_posts_and_likes.sql` replaces
`posts.image_key` with `post_media`. Its primary key is `(post_id, position)`;
each attachment stores an upload reference, object key and dimensions. New posts
reference owned, completed, nondeleted `image_uploads`. An upload can be reused
across posts, but cannot appear twice in one post. Legacy image keys are backfilled
with nullable upload references/dimensions instead of invented metadata.

Text posts require a body and no attachments. Image posts require attachments
and may also have a body. Existing link posts remain readable with their original
URL semantics. A deferred database constraint checks attachment/type consistency
at transaction commit. Images stay in Storage; only references and metadata enter
PostgreSQL. `backend/models.py` mirrors these migrations by hand.

| Endpoint | Behavior |
|---|---|
| `POST /posts` | Verified active account required. Accepts `submission_id`, `title`, optional `body`, ordered `image_ids`. Saves to General as pending. |
| `GET /posts?limit=20&cursor=...` | Approved posts plus the signed-in author's own posts, excluding soft-deleted posts/spaces. Returns `items` and `next_cursor`. |
| `DELETE /posts/{id}` | Verified active author only (FR-34). Soft-deletes the post and decrements the space count atomically. Returns 204; missing, other authors' and already-deleted posts return 404. |
| `GET /posts/{id}/media/{position}/preview` | Checks post visibility before returning an expiring Storage URL. |
| `PUT /posts/{id}/like` | Sets the authenticated verified student's like. Repeated requests do not add extra likes. |
| `DELETE /posts/{id}/like` | Removes that student's like; retries do not reduce the count again. |

Limits: title 1–300 characters, optional body up to 20,000 characters, up to 10
images. Blank text is treated as absent; at least text or one image is required.
Each image is JPEG, PNG or WebP, at most 10,000,000 bytes. Browser editing remains
optional; feed images use their natural ratio with `object-contain`. No permanent
crop is imposed by rendering. See [image details](image-uploads.md) for editing,
format and trusted-validation limitations.

Feed ordering is `(created_at DESC, id DESC)` with an opaque cursor, avoiding
offset shifts when new posts arrive (FR-66). Like rows, cached counts, author
karma and stored hot ranking change in one transaction under a post row lock
(FR-50/51/52/54). The main feed still sorts chronologically. Browser INSERT/DELETE
policies on `post_likes` are removed: all post like writes must use FastAPI.

Private Storage retains owner access. A separate SELECT policy permits reading
objects attached to approved, nondeleted posts in nondeleted spaces. Pending
attachments remain owner-only. Signed preview URLs expire after five minutes;
previously issued URLs remain bearer capabilities until expiry.

## Retries and atomicity

Post responses include viewer-specific `can_delete`; the feed offers verified
authors a Delete post button with confirmation and removes the card after success.
Deletion works for text, image and legacy link posts. Media references and private
uploads remain intact because uploads can be reused by other posts. Deleted posts
cannot issue new post preview URLs; existing signed URLs last until expiry.

The composer caches completed transfers by selected `File` and retries uncertain
completion without retransferring. Reselect a file to start a new transfer if no
object reached Storage. A post request uses one UUID `submission_id` throughout
retries: the backend returns the saved post for identical content or rejects
changed content with 409. After an uncertain save, retry unchanged or check the
feed before starting a different post.

Post creation, ordered references and the space counter are atomic. File transfers
precede that transaction, so a cancelled/failed post can leave private unattached
assets. Automated cleanup is not implemented; see the image pipeline retention
notes. Do not delete Storage object rows directly with SQL.

## Verification

Run backend unit tests and frontend lint, TypeScript, tests and build as described
in the README. An opt-in database integration check is also available:

```sh
cd backend
uv run python scripts/check_post_database.py --run
```

It uses the configured database and an existing verified active profile. It
checks actual post persistence, ordered media, idempotent creation, cursor order,
author-only pending visibility, like/unlike counts, RLS and the media constraint.
Every test change is enclosed in an outer transaction and rolled back, including
counter changes. It creates no Auth accounts or Storage objects and does not test
browser interactions or real image transfers. Apply migrations before running it.

Browser acceptance checks with both apps running:

1. Sign in, open `/submit`, save a text-only post; refresh the feed and confirm it
   remains with a pending label. Repeat with images only and text plus images.
2. Add multiple images, crop/resize one, discard another edit, reorder attachments
   and submit. Confirm saved images and display order after refresh.
3. Like a visible post, refresh, then click again to unlike and refresh again.
4. Sign out or switch accounts: pending posts and their images must disappear.
   Guests see approved posts but cannot like; unverified users cannot write.
5. Try an empty post, invalid file and oversized file; submission stays blocked.

Shared database deployment on 2026-09-24 was explicitly authorized for this
milestone, including the pending branding migration. Future migrations follow
local feature-branch testing and the normal two-approval merge workflow. Older
code that selects `posts.image_key` must update with this migration.
