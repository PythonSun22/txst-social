# PLAN.md

Working plan for the current sprint. **Not fixed** — we revise this as we go.
The full semester breakdown lives in `docs/Two_Week_Sprint_Timeline.md`.

Read `AGENTS.md` and `supabase/migrations/20260910200000_lynx_core.sql` before
starting. Cite `FR-` numbers (top of that migration) in commits and PRs.

---

## Registration (`Signup` branch)

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

_Revise this file whenever the plan changes. Keep it short._
