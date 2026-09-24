# CLAUDE.md — TXST Lynx

This file is loaded automatically by Claude Code for every teammate. It is the
Claude-specific layer on top of the project's shared assistant brief.

## Read this first

**`AGENTS.md` at the repo root is the canonical context** — what the product is,
the settled rules, the data model, the open decisions, and the mistakes a fresh
model reliably makes here. It is imported below so it is always in context.

@AGENTS.md

When `AGENTS.md` and this file disagree, `AGENTS.md` wins on *product and data*;
this file wins on *how to work in the repo with Claude Code*.

For anything about the database, read
`supabase/migrations/20260910200000_lynx_core.sql` before answering — it explains
its own reasoning at length. `README.md` has setup, commands, and endpoints.
`docs/documentation.md` is the team's documentation standard.

## Planning

Per team + global convention, non-trivial work should be captured as an ordered
step list with explicit constraints and non-goals in `docs/PLAN.md` before code
is written. If it is missing when a real feature starts, offer to create it
first. Cite `FR-` requirement numbers (listed at the top of the core migration)
in the plan, commits, and status notes.

## Running the app

Frontend and backend run in separate terminals.

```bash
# frontend  → http://localhost:3000
cd frontend && npm install && npm run dev

# backend   → http://127.0.0.1:8000  (interactive API docs at /docs)
cd backend && uv sync && uv run fastapi dev main.py
```

Backend needs `backend/.env` with `DATABASE_URL` (copy `backend/.env.example`;
get the real value privately from a teammate, never commit it).
Lint the frontend with `npm run lint` before a PR.

## Working agreements in this repo

- **Branches** — never commit to `main`. Feature branches come off `dev` and
  return via PR. `git checkout dev && git pull && git checkout -b feature/<name>`.
- **Schema changes are migrations**, committed to git — never click in the
  Supabase dashboard. `supabase migration new <name>`, preview with
  `supabase db push --dry-run`, then `supabase db push`.
- **`backend/models.py` mirrors the migrations by hand.** Change one, change the
  other in the same commit. There is no autogeneration.
- **Respect open decisions.** If an answer depends on `[D-4]` (classifier
  timeout) or `[D-5]` (colleges vs. departments), say so — don't silently pick.
- **RLS is on for every table.** A query that mysteriously returns nothing is an
  RLS policy gap before it is a bug in the query.
- **Match the existing style** — SQLAlchemy 2 `Mapped[...]` / `mapped_column`,
  Pydantic v2 `ConfigDict(from_attributes=True)`, explicit `select(...)`,
  endpoints take `db: Session = Depends(get_db)`. Comment *why*, not *what*
  (see `docs/documentation.md` §5).
- **Docs are part of feature completion** — TSDoc / docstrings / FastAPI
  descriptions and any affected file in `docs/` update in the same PR.
- **Prefer the boring solution.** Five people learning this stack, fixed
  deadline. Build only what the current sprint needs (see
  `docs/Two_Week_Sprint_Timeline.md`).
- Don't restructure the repo or change the git workflow without team agreement.
- The official site name is **TXST Lynx**. Keep the repository name `txst-social`.
- Every merge requires **two approvals**. Test migrations locally first; see
  `docs/local-development.md` and the recorded deployment exceptions in AGENTS.md.
- Preserve image-module independence; read `docs/posts-and-media.md` before
  changing post composition, uploads or likes.


## Keeping context current

**When an important feature lands** (a new endpoint group, a model, an auth
flow, a data-model migration, a frontend page wired to the API), in the same
change:

- Update `AGENTS.md` — §7 "Where the project is", the data-model section if
  tables changed, and move any resolved item out of §6 "Open decisions".
- Update **Project status** below.
- Keep edits tight. Git history is the changelog; these files are a map.

A stale context file is worse than none, because it is believed.

## Project status

_Claude keeps this current — see above._

**Working today:** health/profiles, Supabase existing-account login and identity,
private image uploads with browser crop/resize, persistent General text/image/mixed
posts, chronological cursor feed and authenticated persistent post likes/unlikes.
New posts remain author-visible pending (FR-90); comments and moderation are still
schema only. See `docs/posts-and-media.md` for reusable module contracts and tests.
**Working today:** `GET /health`, `GET /db-health`, `GET /profiles`. Other feature
APIs are not implemented. OpenAI is selected for moderation; a standalone text
screening module/CLI exists in `backend/moderation.py` (FR-90–92). See
`docs/moderation.md`. Publication and database integration remain future
work; [D-4] is still open.

**Current sprint:** Sprint 2 (Sep 14–27) — first full-stack vertical slice.
Registration/recovery UI and classifier integration remain future work.

## Team

Individual work notes below may describe earlier UI milestones. The current
implementation is recorded in **Project status** above and `docs/posts-and-media.md`.

Each teammate has a subsection: what they're working on now, which files/areas
are theirs at the moment, and anything Claude should remember when helping them.

**At the end of a working session, identify who you helped:**

```bash
git config user.email
```

Match it below and update **only that person's** subsection — refresh their
current focus, clear stale "working on" notes when a feature lands, add useful
context for next time. No match → add a new subsection (name from
`git config user.name`). Never edit another teammate's subsection.

### Sachin Pandey — xachin300@gmail.com

- **Working on:** repo tooling and assistant context (`CLAUDE.md`, `AGENTS.md`).

- **Notes for Claude:** —

### Daniel Pelley — daniel.pelley@outlook.com

- **Working on:** frontend theme and feed UI on `feature/initial-ui-fyp`,
  adapted from the Figma Make mockup the original `.make` design file in `work/cs4332/` (one
  level above the repo). Maroon/gold tokens in `globals.css`; `Navbar`
  replaced `Sidebar`; `PostCard`, `SortBar` and the ForAll page still use mock data. `/submit` +
  `PostComposer` is the create-post form, not yet wired to an endpoint.
- **Notes for Claude:** learning the stack, so wants short, plain explanations.
  The mockup is Reddit-shaped (downvotes, Rising, flair, Save); use it for the
  look only, never for product rules.

### Misan Parajuli — bgg66@txstate.edu

- **Current focus:** OpenAI text moderation starter (FR-90–92).
- **Session context:** selected OpenAI; the official SDK starter and offline tests are in `backend`, with setup and design guidance in `docs/moderation.md`. A local key is configured, but live verification returned HTTP 429 (`Too Many Requests`, type `invalid_request_error`, no specific code or Retry-After). The cause remains unresolved; do not assume billing. Publication rules and [D-4] remain open.
