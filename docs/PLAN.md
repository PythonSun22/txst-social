# PLAN.md

Working plan for the current sprint. **Not fixed** — we revise this as we go.
The full semester breakdown lives in `docs/Two_Week_Sprint_Timeline.md`.

Read `AGENTS.md` and `supabase/migrations/20260910200000_lynx_core.sql` before
starting. Cite `FR-` numbers (top of that migration) in commits and PRs.

---

## Automatic ForAll moderation (FR-32, FR-60, FR-90–92)

1. Add migration and matching ORM fields for durable attempt counts, retry times,
   worker leases, exhausted failures, and full classification audit results.
2. Extend the existing provider adapter to screen title/body and all attached
   images. Sign private images with a backend-only Storage secret. Any provider
   or category flag blocks; only a complete unflagged response approves.
3. Start an opt-in background worker with FastAPI's lifespan after the migration
   is applied to the configured database. Claim committed General
   posts oldest first, including the pending backlog; release database locks
   during network calls. Lease tokens and content fingerprints reject stale
   results. Persist the decision and audit in one transaction.
4. Bound automatic attempts (default 3 total; delays 30s then 120s). Failures
   stay pending, with a persisted exhaustion state and an author-facing message.
   Refresh pending cards automatically while preserving feed pagination.
5. Verify provider, storage, scheduling, crash recovery, concurrency, visibility,
   and failure behavior offline and against isolated local PostgreSQL when
   available. Update setup, status docs, and Misan's session notes.

**Constraints:** no human review for ForAll, no publication on failure, no
client-controlled status, no tokens or signed URLs in audit/logs. Keep image
upload modules reusable. SDK retries stay off so the persisted limit is real.
Do not apply this migration or screen real shared posts before the normal
review/deployment process; the prior shared-database exceptions do not apply.

**Non-goals:** reports, comments, subcommunities, account sanctions, post editing,
custom score thresholds, profanity rules, and fetching legacy link destinations.
Legacy link posts remain pending rather than being approved without screening
their destination. [D-4] is resolved for this slice as pending plus bounded
retries; timing defaults are configurable. Editing/re-screening policy is deferred.

**Verification:** implementation complete. Backend tests include isolated
PostgreSQL migration/worker checks with mocked provider calls. Live Supabase
Storage/OpenAI verification and shared deployment remain outstanding; do not
treat the PostgreSQL schema stand-ins as full Supabase end-to-end coverage.

---

## Registration (`Signup` branch)
## OpenAI moderation starter (FR-90–92)

Auth foundation (existing-account sign-in, `/auth/me`, Supabase-validated
identity) is already merged from `Frontend`. There's currently no way for a
new student to create an account through the UI — this closes that gap.
Bumps ahead of the posts work noted below, which stays queued.

**Relevant FRs:** FR-01 (`txstate.edu` only, enforced by a DB trigger — not
app code), FR-02 (email verification gates posting/commenting/liking), FR-04
(signed-out visitors keep read-only access; signup doesn't change that).

### Steps

1. Add a sign-up mode to `AuthForm.tsx` — a toggle alongside the existing
   sign-in form, calling `supabase.auth.signUp({ email, password })`. Same
   component and patterns already used for sign-in, not a new file.
2. Handle the post-signup state explicitly: `signUp()` returns no session
   (confirmed this session against the real project). Show "check your
   email to confirm your account" — don't fall through to the sign-in form
   and leave the user guessing why they're not logged in.
3. Surface real errors instead of a raw dump: non-`txstate.edu` address (the
   DB trigger's rejection message), already-registered email, weak
   password, and `429 over_email_send_rate_limit` (hit this ourselves
   testing — needs a plain "try again shortly," not the raw JSON).
4. Manual verification: sign up with a real inbox (a fake address can never
   confirm — proven this session), confirm via the emailed link, then sign
   in through the same form.

### Non-goals (this pass)

- No password reset / account recovery UI.
- No OAuth/social login.
- No profile-completion step (username selection). This branch's backend
  has no `POST /profiles/me` yet — the provisional username from the
  signup trigger is fine for now.
- No conditional Sidebar (hide/show links by auth state) — related, but a
  separate piece of work from signup itself.
- No backend changes. Signup goes straight to Supabase, same as sign-in
  already does — the backend never sees credentials.

---

## Then (deferred while registration lands)

1. General-only retrieval and authenticated text creation (FR-30, FR-60),
   including per-space bans (FR-95). Derive authors from the verified
   profile. New posts stay pending and are visible to their author (FR-90).
2. Add ordered `post_media`, migrate existing image keys, then private
   Storage uploads and an image-capable composer/card (FR-31, FR-32).
   Required titles remain; support text only, images only, and text plus
   images.
3. Verify persistence after refresh and pending-media isolation across
   accounts.

Classifier integration and `[D-4]` remain deferred. No auto-approval.
Comments, persistent likes, advanced ranking, and gallery features are
outside this slice.

1. Install the authorized OpenAI SDK with `uv add openai`, updating the project
   dependency declaration, lockfile, and backend virtual environment.
2. Implement a standalone text-screening module returning provider flags, category
   scores, model identity, and latency, with a local command-line example.
3. Check success, empty input, missing configuration, and provider failure without
   using real credentials; document how to run a live check.
4. Consolidate moderation guidance and setup into `docs/moderation.md`, update

   references, and refresh the project context and Misan's session notes.
never a successful result. This module makes no publication decision. [D-4]
**Constraints:** API keys stay server-side. Screening failures raise an error,
(timeout/retry policy) remains open; the starter's network timeout only bounds
the standalone request.

**Non-goals:** endpoints, database writes/migrations, image screening, profanity
rules, policy thresholds, moderator review, or background jobs.

**Verification:** SDK transition and documentation consolidation complete. Six
offline tests pass using the real SDK with a mocked HTTP transport, including
invalid responses, provider failures, and no automatic retries. Live provider
verification requires a local `OPENAI_API_KEY`.
_Revise this file whenever the plan changes. Keep it short._
