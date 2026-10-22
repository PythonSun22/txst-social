# Optimized image assets (FR-32, FR-90–92)

This is the current implementation as of October 22, 2026. Images upload directly
from the browser to private Supabase Storage. A trusted backend worker decodes,
resizes, re-encodes and screens each asset before its generated versions become
public. FastAPI request handlers still handle metadata, not upload bytes; the
background processing/moderation workers now transfer bounded image bytes.

## Outputs and compression controls

Edit **`backend/image_processing.py`, `PRESETS`** and restart the backend:

| Purpose | Version | Maximum bounds | WebP quality |
|---|---|---|---|
| Post | `preview` | 600 × 600 | 78 |
| Post | `expanded` | 2000 × 2000 | 85 |
| Avatar | `avatar_small` | 96 × 96 | 80 |
| Avatar | `avatar_large` | 384 × 384 | 85 |
| Banner | `banner` | 1600 × 1600 | 82 |

Bounds are a containing rectangle, not a stretch or forced crop. Post and banner
ratios are preserved; avatars get a centered square crop after browser edits.
Small inputs are never enlarged. Width and height in each variant record are
measured from the actual output. Quality is 1–100: lower means smaller/lossier;
dimensions reduce pixels as well. These are settings, not guaranteed KB targets.
Test photographs AND screenshots/text-heavy flyers before lowering quality.

`MAX_SOURCE_PIXELS` caps decoded inputs at 25 million pixels, independently of
the existing 10,000,000-byte upload cap. Only still JPEG, PNG and WebP inputs are
accepted. The worker verifies the actual decoder format against declared MIME,
applies EXIF orientation, preserves alpha, strips source metadata and re-encodes
as WebP. Browser editing remains optional and is not trusted validation.

Changes to presets affect future processing only. Existing ready variants are
immutable; this release has no regeneration endpoint. Do not reset a ready asset
to pending: the original may already have been removed. Re-upload to try new settings.

## Asset lifecycle

`POST /images` accepts `purpose` (`post`, `avatar`, `banner`; default `post`).
`POST /images/{id}/complete` still confirms source transfer, not readiness.
`uploaded_at` and original size/dimensions remain historical source metadata.

The durable queue is `image_uploads`: `pending` -> `processing` -> `ready` or
`blocked`. Network failures consume bounded attempts and eventually become
`failed`. Attempts and 10-minute leases persist across API restarts. A single
worker processes one asset at a time per API process; row locks/leases coordinate
multiple processes. No processing/provider call holds a database transaction.
Crashes on the last attempt become failed after lease expiry. There is no user
retry/reset endpoint for exhausted jobs; fix configuration and submit a new asset.

The worker first generates all versions in memory. It screens the largest
display version using an inline data URL, then stores every version privately.
Any provider overall/category flag blocks the asset. Failure never approves it.
Variant rows, the `image_processing_checks` audit and the verdict commit together.
No source bytes, data URLs, signed URLs, credentials or source text enter audits.
Writes use attempt-specific keys, preventing stale jobs from replacing live files.

Post images get image-only screening at asset processing AND title/body-plus-image
screening in the existing post worker. This intentionally costs additional model
requests: an asset passing alone does not approve a post's text or context.
Posts waiting for asset processing do not consume their post-screening attempts.
Blocked assets block their pending posts; failed assets leave posts private and
eventually show the existing screening-failed notice. The narrow contextual
recheck remains text-only and never overrides image verdicts.

`post_media` keeps one asset reference per attachment, so four images produce
eight files without duplicating attachments. Feed cards request `preview` and
lazy-load the image bytes. The native dialog viewer requests `expanded` only when
opened; previous/next loads just the selected image.

Profile replacements are separate pending references on `profiles`. The old
approved avatar/banner stays active until the new asset is ready. A stale worker
cannot activate an asset after the student selects a different replacement.
Rejected/failed replacements retain the old image and display an explanation.
Only purpose-matching uploads may be selected. Database triggers also enforce
approved owned current avatar/banner references.

Active approved profile assets have public signed-preview access for avatars
beside public posts. Pending replacements and unattached assets are owner-only.
Storage RLS recognizes approved variants attached to approved nondeleted posts,
or referenced by active profiles. Originals never acquire public post access.
Private audit tables have no browser read/write policy. Signed URLs last five
minutes; removing a reference does not revoke a URL already issued.

## Original deletion and deferred cleanup

After all versions are stored and screening has a final verdict, the worker
schedules deletion of the temporary original via the Storage API. It waits at
least **7,500 seconds after reservation** (two hours plus five minutes) because
issued Supabase signed upload tokens can remain valid for two hours. Otherwise
a late transfer could recreate an already deleted original. Existing old inputs
whose grace window has elapsed can be deleted on the next cleanup tick.

`original_deleted_at` records successful cleanup; failures retry after five
minutes. Deletion of the original never deletes the ready variants. `size_bytes`
still describes the original even after its bytes are removed; inspect
`image_variants.size_bytes` for retained sizes. `/upload-test` shows both.

Per-account quotas/rate limits, abandoned/failed-job cleanup, files left by a
process crash during variant writes, and hard deletion of replaced/deleted assets
are explicitly deferred. Post deletion remains soft deletion. Original input
cleanup above is the only permanent-deletion lifecycle added in this release.
Processing and source cleanup run only while the API/image worker is running.

## Local setup and verification

1. Keep `DATABASE_URL` and both Supabase URLs pointed at the same **local** instance.
2. Apply all pending migrations with `supabase migration up --local`, including
   `20260926000000_automatic_post_moderation.sql` and
   `20261022072231_image_variants.sql`. Do not deploy shared migrations before review.
3. From `backend`, run `uv sync` (Pillow is now a dependency).
4. Configure backend-only `SUPABASE_SECRET_KEY` (or legacy service role) and
   `OPENAI_API_KEY`. Set `IMAGE_PROCESSING_ENABLED=true` and
   `MODERATION_ENABLED=true`; restart FastAPI. Never expose these secrets in Next.js.
5. Start the frontend normally. `IMAGE_PROCESSING_MAX_ATTEMPTS` defaults to 3,
   retry seconds to 30 (then 120), polling to 2 seconds. Presets are configured
   in Python, not frontend environment variables.

Migration compatibility: existing original uploads enter the queue without being
auto-approved. Previously approved image posts become pending and re-screen with
generated variants before returning to public feeds. Existing profile references become pending and are hidden until
screened. Legacy sources shared by posts and profile slots stay post-purpose;
re-upload those profile images. If an old source served both avatar and banner,
the avatar is queued and its banner must be re-uploaded. Legacy attachments with
no upload reference cannot be regenerated automatically and need re-upload.

Automated checks:

```sh
cd backend
uv run python -m unittest discover -s tests -v
cd ../frontend
npm test
npm run lint
npx tsc --noEmit
npm run build
```

The optional database tests require a fresh disposable loopback PostgreSQL
database named `moderation_test*`, with `MODERATION_TEST_DATABASE_URL` configured.
They apply all migrations against Auth/Storage schema stand-ins; providers and
Storage HTTP remain mocked. Never point them at the shared database.

Browser checklist:

1. Upload four photos in `/submit`, reorder them, submit, and verify eight variant
   rows. Check processing -> approved and public visibility from another account.
2. Inspect network requests: feed URLs use `variant=preview`; opening one photo
   requests only its `expanded` version. Check previous/next, Escape, keyboard
   focus, portrait images and transparent PNG input.
3. Upload an avatar and banner. Save while processing. Confirm the old versions
   stay visible until approval; rejected or failed replacements never replace them.
4. Compare original bytes against variant totals in `/upload-test`; check actual
   sharpness on a phone and high-density display, especially flyer text.
5. After the original-token grace period, confirm `original_deleted_at`, missing
   original bytes and still-working optimized previews. Restart to test recovery.
6. Disable either worker or simulate Storage/provider failure: content must stay
   private and show processing/failure status rather than publishing unscreened.

## Files changed in this implementation

### New files

- `backend/image_processing.py`
- `backend/image_processing_worker.py`
- `backend/image_worker_storage.py`
- `backend/tests/test_image_processing.py`
- `backend/tests/test_image_processing_database.py`
- `backend/tests/test_image_worker_storage.py`
- `docs/image-processing.md`
- `frontend/src/components/ImageViewer.tsx`
- `supabase/migrations/20261022072231_image_variants.sql`

### Updated files

- `AGENTS.md`
- `README.md`
- `backend/.env.example`
- `backend/image_schemas.py`
- `backend/images.py`
- `backend/main.py`
- `backend/models.py`
- `backend/moderation_worker.py`
- `backend/post_schemas.py`
- `backend/posts.py`
- `backend/profile_routes.py`
- `backend/profile_schemas.py`
- `backend/pyproject.toml`
- `backend/tests/test_auth.py`
- `backend/tests/test_images.py`
- `backend/tests/test_moderation_database.py`
- `backend/tests/test_moderation_worker.py`
- `backend/tests/test_posts.py`
- `backend/tests/test_profiles.py`
- `backend/uv.lock`
- `docs/image-uploads.md`
- `docs/local-development.md`
- `docs/moderation.md`
- `docs/posts-and-media.md`
- `frontend/src/app/profile/page.tsx`
- `frontend/src/components/EditProfileModal.tsx`
- `frontend/src/components/ImageUploadLab.tsx`
- `frontend/src/components/ImageUploader.tsx`
- `frontend/src/components/PostCard.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/images/image-api.ts`
- `frontend/src/lib/posts.ts`

