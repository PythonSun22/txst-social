# CLAUDE.md — Boko Lynx

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
- Don't rename the project — it has three names in different files and settling
  that is a deliberate team task, not a drive-by edit.


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

**Working today:** `GET /health`, `GET /db-health`, `GET /profiles`. Everything
else — posts, comments, likes, feeds, auth, moderation — is **schema only**: the
tables exist in `20260910200000_lynx_core.sql`, the API does not.

**Current sprint:** Sprint 2 (Sep 14–27) — first full-stack vertical slice:
posts through every layer, create + retrieve, browser to database and back.

**Then:** Sprint 3 — Supabase Auth, registration/login, authenticated profiles,
posts associated with users.

## Team

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
