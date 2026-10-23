# Optimized image assets (FR-32, FR-90–92)

This is the current implementation as of October 22, 2026. Images upload directly
from the browser to private Supabase Storage. A trusted backend worker decodes,
resizes, re-encodes and screens each asset before its generated versions become
public. FastAPI request handlers still handle metadata, not upload bytes; the
background processing/moderation workers now transfer bounded image bytes.

## Outputs and compression controls

Edit **`backend/images/processing.py`, `PRESETS`** and restart the backend:

| Purpose | Version | Maximum bounds | WebP quality |
|---|---|---|---|
| Post | `preview` | 600 × 600 | 78 |
| Post | `expanded` | 2000 × 2000 | 85 |
| Avatar | `avatar_small` | 96 × 96 | 80 |
| Avatar | `avatar_large` | 384 × 384 | 85 |
| Banner | `banner` | 1600 × 1600 | 82 |

Byte caps in `backend/images/schemas.py`, `VARIANT_MAX_BYTES`, constrain generated
files to their reserved headroom. Oversized encodings reduce quality, then
dimensions; the table above describes normal maximum settings.

Bounds are a containing rectangle, not a stretch or forced crop. Post and banner
ratios are preserved; avatars get a centered square crop after browser edits.
Small inputs are never enlarged. Width and height in each variant record are
measured from the actual output. Quality is 1–100: lower means smaller/lossier;
dimensions reduce pixels as well. These are settings, not guaranteed KB targets.
Test photographs AND screenshots/text-heavy flyers before lowering quality.

`MAX_SOURCE_PIXELS` caps decoded inputs at 25 million pixels, independently of
the 2,000,000-byte transfer cap (legacy decoding still permits 10,000,000 bytes). Only still JPEG, PNG and WebP inputs are
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

## Original deletion and unused-asset cleanup

After all versions are stored and screening has a final verdict, the worker
schedules deletion of the temporary input via the Storage API. New authenticated
uploads close their reservation at completion and need no two-hour wait. A Storage
metadata trigger fences late writes on the same upload row lock. Inputs remain
available through processing retries; terminal results make cleanup eligible.
Legacy signed uploads still wait at least **7,500 seconds after token issuance**.
Old tokens are not revoked by switching the frontend.

`original_deleted_at` records successful cleanup; failures retry after five
minutes. Deletion of the original never deletes the ready variants. `size_bytes`
still describes the original even after its bytes are removed; inspect
`image_variants.size_bytes` for retained sizes. `/upload-test` shows both.

The shared account budget is now 50 MB with 10 unfinished slots. The storage
ledger holds capacity before transfer, counts uncertain variant writes, and
reconciles actual bytes atomically at terminal processing. Expired abandoned and
invalid-input failures can be cleaned once their reservation is closed; recoverable
service failures preserve completed inputs. Legacy inputs retain token grace; interrupted variant
writes are cleaned after their attempt ends. Failed deletion retains the charge.
See [storage accounting](image-uploads.md#account-storage-budget-and-unfinished-uploads-fr-32).
Reference-aware cleanup now permanently removes unused image files. Post deletion
still retains a post tombstone and media/audit metadata. A deleted post queues its
images, and profile activation queues the previous image only after its replacement
is approved. Cleanup rechecks all live references before retiring an asset, then
deletes variants after a five-minute grace and inputs after safe reservation closure
(or legacy token expiry).
Never-attached uploads have a 24-hour grace. See
[cleanup details](image-uploads.md#unused-file-cleanup-and-hard-deletion-fr-3234).
Processing and cleanup require the image worker to be running.

## Local setup and verification

1. Keep `DATABASE_URL` and both Supabase URLs pointed at the same **local** instance.
2. Apply all pending migrations with `supabase migration up --local`, including
   `20260926000000_automatic_post_moderation.sql` and
   `20261022072231_image_variants.sql`, `20261022094443_image_upload_limits.sql`,
   `20261022095634_image_storage_budget.sql`, and
   `20261022102230_image_asset_cleanup.sql`. Do not deploy shared migrations before review.
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
5. After terminal processing (or legacy token grace), confirm `original_deleted_at`, missing
   original bytes and still-working optimized previews. Restart to test recovery.
6. Disable either worker or simulate Storage/provider failure: content must stay
   private and show processing/failure status rather than publishing unscreened.

## Files changed in this implementation

### New files

- `backend/images/processing.py`
- `backend/images/worker.py`
- `backend/images/worker_storage.py`
- `backend/tests/test_image_processing.py`
- `backend/tests/test_image_processing_database.py`
- `backend/tests/test_image_worker_storage.py`
- `docs/image-processing.md`
- `frontend/src/components/images/ImageViewer.tsx`
- `supabase/migrations/20261022072231_image_variants.sql`

### Updated files

- `AGENTS.md`
- `README.md`
- `backend/.env.example`
- `backend/images/schemas.py`
- `backend/images/routes.py`
- `backend/main.py`
- `backend/models.py`
- `backend/moderation/worker.py`
- `backend/posts/schemas.py`
- `backend/posts/routes.py`
- `backend/profiles/routes.py`
- `backend/profiles/schemas.py`
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
- `frontend/src/components/profiles/EditProfileModal.tsx`
- `frontend/src/components/images/ImageUploadLab.tsx`
- `frontend/src/components/images/ImageUploader.tsx`
- `frontend/src/components/posts/PostCard.tsx`
- `frontend/src/lib/profiles.ts`
- `frontend/src/lib/images/image-api.ts`
- `frontend/src/lib/posts.ts`


## Browser preparation and authenticated transfer

`frontend/src/lib/images/image-prepare.ts` contains `UPLOAD_PRESETS`: posts use a
2000 px maximum edge / 1 MB target; avatars a centered square up to 512 px / 200 KB
target; banners a 1600 px maximum edge / 600 KB target. Canvas tries WebP qualities
0.85, 0.75, 0.65 and 0.55, then smaller dimensions if needed. JPEG is the fallback
when WebP export is unavailable; transparent JPEG fallbacks use a white background.
The hard transfer cap is 2 MB. Encoding failure never falls back to the untouched
original. Targets are estimates; final worker presets/byte caps remain authoritative.

Apply `20261022120000_authenticated_image_uploads.sql`, which lowers the bucket cap,
adds `upload_method`/`upload_expires_at`, and preserves old signed rows/charges.
Stop older backend instances before migration; restart both apps afterward. No new
secrets are required. Old browser tabs must reload.

## Service failures and safe recovery (FR-32/90–92)

`20261023010000_preserve_recoverable_images.sql` protects sources after service
failures. `recovery_required=true` survives exhausted retries and remains set
while a manual retry runs; only a committed verdict plus stored versions clears
it. Such assets are excluded from automatic source and unused-asset cleanup.
Unexpected interruptions also preserve inputs. Uploaded jobs still pending or
processing are not treated as 24-hour abandoned selections. Incomplete transfers
still expire after their reservation deadline. Explicit owner abandonment is a
separate action and cannot remove active post/profile content or a leased job.

Before deleting a successful source, cleanup requires the full purpose-specific
variant set and confirmed, nondeleted ledger rows. Storage also rejects source
DELETEs without that condition, a deliberately retired asset, or a specifically
invalid/expired input. This guard applies even to elevated Storage callers.

OpenAI 401/403, missing configuration and Storage authentication errors trip a
process-local circuit breaker shared by both workers. The current job stays
private, its credential-failed attempt is refunded, and no further jobs/cleanup
are claimed until backend restart. Outages/timeouts retain bounded retries;
exhausted jobs can be retried after service restoration. No key is printed.

`GET /workers/status` requires authentication and reports worker ID, enabled
flags, pause status and a safe reason. Logs use worker/job IDs and error codes;
no provider response body, image bytes or credentials. This reports only the
current backend process; it cannot pause another developer's machine.

Owner APIs: `POST /images/{id}/retry`, `POST /posts/{id}/retry-screening`, and
`DELETE /images/{id}` for explicit unused-asset discard. Retry keeps the original
asset ID, checks retained-source accounting, available headroom, cooldown and the
10-slot limit under the account lock. Concurrent requests reserve headroom once.
Rejected content cannot retry its way to approval. All successful retries still
run image and post moderation. Preserved bytes stay charged; retries do not count
as fresh uploads. Profile images keep their previous approved versions visible.

Failure validation: invalid provider credentials pause both workers before other
jobs; Storage auth errors are distinguished from outages; exhausted service
failures survive source/unused cleanup and database DELETE attempts; concurrent
retries charge once; insufficient quota/foreign owners cannot retry; successful
recovery permits input deletion while retaining both versions. Optional database
tests run only on disposable local databases; actual provider calls are mocked.
A separate local Storage test verifies the real source-deletion guard and final
variant reads. Shared credentials and shared data are not used in those tests.
