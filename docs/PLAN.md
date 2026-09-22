# PLAN.md

Working plan for the current sprint. **Not fixed** — we revise this as we go.
The full semester breakdown lives in `docs/Two_Week_Sprint_Timeline.md`.

Read `AGENTS.md` and `supabase/migrations/20260910200000_lynx_core.sql` before
starting. Cite `FR-` numbers (top of that migration) in commits and PRs.

---

1. Authentication foundation implemented: existing-account sign-in, `/auth/me`,
   Supabase-validated identity, and verified/active profile dependencies
   (FR-01, FR-02, FR-96). No schema changes. Isolated HTTP tests cover failures
   and ownership; a live configured Supabase smoke test is still required.
2. Next: General-only retrieval and authenticated text creation (FR-30, FR-60),
   including per-space bans (FR-95). Derive authors from the verified profile.
   New posts stay pending and are visible to their author (FR-90).
3. Add ordered `post_media`, migrate existing image keys, then private Storage
   uploads and an image-capable composer/card (FR-31, FR-32). Required titles
   remain; support text only, images only, and text plus images.
4. Verify persistence after refresh and pending-media isolation across accounts.

Classifier integration and [D-4] remain deferred. No auto-approval. Comments,
persistent likes, advanced ranking, and gallery features are outside this slice.

_Revise this file whenever the plan changes. Keep it short._
