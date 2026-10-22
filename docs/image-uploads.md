# Image upload pipeline (FR-32)

For current trusted processing, version sizes, profile screening and original
cleanup, read [optimized image assets](image-processing.md). Originals are
temporary; generated WebP versions are the retained/displayed assets.

The `/upload-test` Next.js route is a test harness for a reusable image uploader.
It does not create a post. The first version accepts one JPEG, PNG, or WebP up
to **10 MB = 10,000,000 bytes**, and shows file size, pixel dimensions, reduced
ratio and a local preview. Unedited uploads preserve original bytes/aspect ratio.
The optional browser editor can crop and proportionally resize before submission.

## Data flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as FastAPI
    participant DB as PostgreSQL
    participant Storage as Private Supabase Storage
    Browser->>API: GET /images/policy
    Browser->>Browser: Validate file and decode dimensions
    Browser->>API: POST /images (metadata + bearer token)
    API->>DB: Reserve image_uploads row for authenticated owner
    API->>Storage: Sign object key using caller JWT
    API-->>Browser: Upload ID, bucket, key, upload token
    Browser->>Storage: Transfer file using signed token
    Browser->>API: POST /images/{id}/complete
    API->>Storage: Read object size and MIME metadata
    API->>DB: Mark upload completed if metadata matches
    Browser->>API: GET /images and /images/{id}/preview
    API-->>Browser: Own records and temporary preview URL
    Browser->>Storage: Download private preview
```

The browser never queries application tables. Storage requests are the explicit
direct-transfer exception in AGENTS.md. Supabase Auth manages sessions; FastAPI
checks verified email and active account status for upload/complete (FR-02,
FR-96). Read routes check the active owner. FastAPI signs with the user's JWT
and the existing publishable key, allowing Storage RLS to enforce ownership.
These upload/preview routes need no service-role key. The separate image-processing and post
moderation workers use a backend-only Storage secret for bounded byte transfers
without an author session; see [moderation](moderation.md).

## Modules

| Module | Responsibility |
|---|---|
| `frontend/src/lib/images/image-policy.ts` | Pure file limits, format signatures, byte and ratio formatting |
| `frontend/src/lib/images/image-file.ts` | Browser decode and object URL for preview |
| `frontend/src/lib/images/image-edit.ts` | Crop geometry, proportional sizing and canvas export |
| `frontend/src/components/images/ImageEditor.tsx` | Modal crop/resize session with Save and Discard |
| `frontend/src/lib/images/image-api.ts` | Reserve → transfer → complete; retry completion after an uncertain response |
| `frontend/src/components/images/ImageUploader.tsx` | Drop/browse/edit UI; standalone `onUploaded(SavedImage)` or `selectOnly` with `onSelected(SelectedImage \| null)` |
| `frontend/src/components/images/ImageUploadLab.tsx` | Account state, recent records and saved-file preview for testing |
| `backend/images/routes.py` | Owner checks, reservations, completion and listing |
| `backend/images/storage.py` | Storage REST adapter; no image bytes pass through FastAPI |
| `backend/images/schemas.py` | Limits and upload API contracts |

## Schema and deployment

Migration `20260924191615_image_upload_pipeline.sql` introduces reusable uploads.
The later post-media migration integrates them with posts (see below). `public.image_uploads` holds:

- UUID, owner profile ID, bucket ID and unique generated object key;
- original file name, MIME type and byte size;
- browser-measured width and height (derive aspect ratio; do not store a duplicate);
- creation, completion and soft-deletion timestamps.

RLS is enabled. Owners can select their metadata; browser writes to the table
are denied. Storage INSERT requires a recent reservation for the same owner
and path. Storage SELECT permits owned records; the post-media migration also permits
objects attached to approved, nondeleted posts in active spaces. There is no public
bucket or object overwrite. A reservation is committed before
signing because Storage checks policies through a separate database connection.

The migration creates the `post-images` bucket with a 10,000,000-byte limit and
the three allowed MIME types. The global Storage upload limit must also allow
10 MB; a lower project-wide limit will still reject uploads. Keep the migration
constraints, bucket limits and `backend/images/schemas.py` in step when limits
change. The frontend fetches its policy from FastAPI.

Apply through the repository's normal migration workflow:

```sh
supabase db push --dry-run
supabase db push
```

The CLI must first be linked to the intended Supabase project using the README
setup. Both apps must point at that same project. No additional `.env` values
are required. The backend SQL connection needs privileges for `image_uploads`,
just as it already needs access to `profiles`.

## Rendering and browser editing

The preview uses intrinsic dimensions with `object-contain`, max width and max
height. It fits the entire image without stretching or discarding content.
Uploaded width/height can reserve layout space when integrated into a post.

**Edit image**, to the left of Submit, highlights after a valid selection. The
modal supports dragging a crop rectangle, editing its pixel coordinates, and
choosing full-image, square, 4:5 or 16:9 presets. Presets select centered regions;
subsequent dragging or coordinate changes allow a free ratio. Output width controls
proportional downscaling, capped at the crop size and a 4096-pixel maximum edge.

Save exports a new `File` through canvas and runs `inspectImage` again. The dialog
stays open if the export exceeds the file limit, allowing a smaller output size.
The preview, byte count and dimensions update only after successful validation.
Discard (or Escape) leaves the previous selection unchanged. Reopening edits the
current selection; choosing the source file again restores the original.

Saving edits does not transfer bytes. Submit uses the existing upload pipeline.
If the previous selection was already uploaded, the edited version receives a
new object key; existing uploaded objects are never overwritten. Editing also
clears any pending completion retry so it cannot submit stale metadata.

Canvas export creates a still image and does not preserve source animation or
embedded metadata. JPEG/WebP export uses quality 0.9; the actual exported MIME
type determines the extension if a browser falls back to PNG. Temporary object
URLs and canvas memory are released when replaced or no longer needed.

Feed-wide ratio rules remain a discussion: natural ratio preserves all content;
fixed thumbnail frames can use `object-cover` for a visual crop while a detail
view shows the whole image. Do not silently burn that rendering crop into uploads.
The profile-photo editor is the intentional exception: it starts with a centered
square export and overlays the circular avatar boundary. Dragging repositions the
photo behind a fixed circular viewport, while the 1×–4× control visibly scales the
photo without changing that viewport. The surrounding photo remains visible under
a translucent mask to make repositioning easier, while the circle stays fully
opaque. The saved square matches the circular profile render. Banner and post editing retain
the general rectangular crop controls.

## Post integration and limits

`SavedImage.id` is the integration seam. The implemented `post_media` table
references completed uploads in display order and replaces `posts.image_key`.
The post-create transaction verifies ownership and completion, rejects duplicate
attachments, checks space bans (FR-95), and saves text, images or both. Existing
links remain readable. See [Posts and reusable images](posts-and-media.md) for
the module boundaries, schema, API, retries and tests agents should preserve.

The profile editor uses the same seam for `profiles.profile_image_upload_id` and
`profiles.banner_image_upload_id`. `PATCH /auth/me` accepts only completed,
non-deleted, purpose-matching uploads owned by the authenticated profile. Pending
selections do not replace the current image until the worker approves them.
Approved active profile assets support public signed previews; unapproved assets
are owner-only. No Storage URL is persisted on the profile.

An uploaded file is **not approved content** (FR-90). Upload previews are issued
only to the owner. Post previews additionally allow readers of approved posts.
Both return expiring bearer URLs valid for five minutes. Newly submitted posts
remain author-visible pending until the ForAll worker screens text and images.
Failures stay pending with bounded retries under [D-4].

The transfer-completion endpoint itself is not an image sanitizer. Browser signature and
decode checks provide feedback; Storage enforces byte count and declared MIME
type. Completion compares Storage's actual size/MIME metadata with the reservation.
A separate trusted worker now independently decodes the bytes, enforces a pixel
limit, strips metadata, generates WebP versions and screens them. Source
width/height remain historical browser metadata; variant dimensions are measured.
Optional browser editing is not trusted validation. See [processing](image-processing.md).

Interrupted transfers or failed signing can leave unused reservations; transfers
whose confirmation fails can leave private objects. Retry confirmation uses the
same upload ID and is idempotent. Selecting the file again starts a new reservation.
Automated orphan cleanup and an end-user delete action are not implemented in this
first slice. Before broad use, add retention cleanup through Storage's delete API
(not SQL deletion of `storage.objects`); account-row deletion alone does not remove
object bytes. A signed upload capability can remain valid for two hours, so cleanup
must account for outstanding tokens before removing reservations/objects.

## Shared account upload limits (FR-32)

A post accepts up to **four** images. `GET /images/policy` supplies the composer
with `max_images_per_post`, `uploads_per_minute` and `uploads_per_hour` in addition
to the existing byte/type policy. New database media positions are restricted to
0–3; existing posts with more attachments are preserved, including worker updates
to their object keys.

`POST /images` allows **10 reservations per rolling minute and 40 per rolling
hour per account**, shared across `post`, `avatar` and `banner` purposes. Four
original images consume four slots, even when processing produces eight variants.
The API locks the account's profile row, reads reservation timestamps using the
database clock, and commits the reservation before releasing the lock and signing
the upload. This coordinates concurrent requests across API processes and survives
restarts. No Storage/provider network request holds this account lock.

Incomplete, blocked, failed and soft-deleted reservations all count. A signing
failure also counts because the reservation is already committed. Completion
retries, previews and generated variants consume no additional slots. A rejection
returns HTTP 429, `Retry-After` in seconds, and a wait message displayed by the
existing upload interfaces. The longer wait applies when both windows are full.
Exactly expired timestamps release capacity; limits do not reset on clock minutes
or on the hour.

Change the rate constants in `backend/images/schemas.py` and restart the backend.
The post cap also has a database trigger bound: changing it requires a new
migration as well as the backend constant. Apply
`20261022094443_image_upload_limits.sql` locally before testing; coordinate shared
deployment through the normal review/migration workflow.

## Account storage budget and unfinished uploads (FR-32)

The shared account budget is **50 MB = 50,000,000 bytes**. At most **10 uploads or
processing jobs** may be unfinished. Completed, blocked, or terminally failed jobs
release their unfinished slot; all retained files still consume capacity.

`image_storage_objects` is a backend-only, RLS-protected ledger keyed by object
key. It counts each physical asset once regardless of references. Deleted-object
ledger rows and historical upload sizes do not consume capacity. Unknown transfers
reserve **10 MB per original**, because a signed upload capability permits the
bucket's full limit regardless of the browser's declared size. Successful
completion reconciles that source reservation to Storage's confirmed actual size.

Additional processing headroom per original is **2 MB for posts, 250 KB for
avatars, and 1 MB for banners**. Per-version byte caps are enforced by the encoder:
preview 250 KB, expanded 1.75 MB, small avatar 50 KB, large avatar 200 KB, banner
1 MB. Normal preset quality/dimensions apply first; unusually large encodings
reduce quality to 50 and then dimensions until they fit. This makes the reserved
space a real upper bound rather than an estimate.

Thus four maximum-size post images initially need **48 MB**. An account already
using more than 2 MB cannot reserve that batch. Even smaller selected files need
the full initial capability reservation until completion confirms their size.
The composer calls `POST /images/batch` (1–4 assets) before ANY new transfer;
quota or slot rejection creates no reservations and issues no tokens for that
batch. Single avatar/banner uploads use the same checked reservation path.
`GET /images/budget` exposes stored, reserved, total used, available bytes and
unfinished slots. The composer displays these values and explains headroom.

Rate, slot and capacity checks and reservation inserts hold the same account row
lock. Budget totals use one database snapshot. Upload URLs are signed after
commit. Signing failures retain capacity until token expiry and confirmed cleanup.

The worker persists every planned variant key before attempting its write. Actual
or uncertain writes are covered by the asset's held headroom, including interrupted
attempts. Aggregate staged writes cannot exceed that held capacity. Terminal
results exchange headroom for actual retained object charges atomically. Retries
reuse the remaining held capacity, and incomplete attempts are cleaned up through
Storage. Bounded writes and deletion serialize on object rows, so a stale worker
cannot recreate an object after its charge has been released. Failed deletion
never releases capacity. Provider calls never hold database locks.

An abandoned, unconfirmed reservation expires after its token-safe cleanup horizon
(initially 7,500 seconds, extended after signing a token). Signing and cleanup
serialize on the upload row, including delayed token minting. Expiry releases
its unfinished slot and unused processing headroom, while its possible original
stays charged until Storage confirms deletion. Terminally failed job originals
also receive this cleanup. Keep the image worker enabled for automatic deletion.
The original upload row remains for rate history, audits and historical metadata.

Apply `20261022095634_image_storage_budget.sql` before starting this backend.
Stop old image workers during deployment; restart all API instances afterward.
Backfill charges current Storage inventory and live upload capabilities, including
old owner-scoped orphan objects. Historical variant rows without Storage objects
are not charged. Existing accounts above 50 MB keep their content but cannot add
uploads until usage falls below the budget. No shared database migration is
applied automatically by this change.

Limits live in `backend/images/schemas.py`; new reservations persist their checked
headroom. If changing output caps/headroom, account for already queued jobs with
older reservations. Reducing image dimensions/quality alone needs no schema change.
Broader reference-aware hard deletion of replaced/deleted assets remains future
work. Delete bytes through Storage before retiring ledger rows; foreign keys
prevent silently discarding accounting while retained files still exist. Preserve
at least one hour of reservation history (or introduce a rate ledger) when later
hard-deleting upload rows.

## Verification

```sh
cd backend
uv run python -m unittest discover -s tests -v
```

```sh
cd frontend
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Backend tests mock Auth, Storage and the SQL session. They cover ownership,
verification, invalid/oversized inputs, object metadata mismatch, private preview,
retrying completion, and POST CORS. Frontend tests cover the byte boundary,
unsupported files, signatures and ratio calculations. Neither replaces a live
Storage/RLS smoke test after migration.

Manual checks with both apps running:

1. Open `/upload-test`; signed-out visitors can inspect a valid file but cannot submit.
2. Sign in as a verified student. Drop landscape, portrait and square images;
   confirm dimensions/ratio and the highlighted Submit image button.
3. Try an empty file, a renamed non-image, an unsupported format, multiple files,
   and a file above 10,000,000 bytes. Submission stays disabled with feedback.
4. Upload a valid image. Check the private saved preview, refresh, and click
   **View saved** to prove the metadata and bytes persisted.
5. Sign in as a different account: it must not list or preview the first account's
   image. A guessed upload UUID must return 404 from completion/preview routes.
6. Interrupt the completion request after transfer. **Retry confirmation** should
   complete the same upload, without transferring the image a second time.

Storage references:
[signed uploads](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl),
[file limits](https://supabase.com/docs/guides/storage/uploads/file-limits),
[access control](https://supabase.com/docs/guides/storage/security/access-control).
