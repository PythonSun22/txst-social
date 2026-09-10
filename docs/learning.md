# Learning Boko Lynx

Every link here was checked and works. Nothing is included because it is
famous — each one is here because it explains something this project actually
does, and most entries say which part of our repo it explains.

Read section 1 first. It is short, and the rest makes much more sense after it.

**If you only have one hour this week**, do these three things:

1. Read section 1 below (10 minutes).
2. Play [Learn Git Branching](https://learngitbranching.js.org/) up to
   "Rebase Introduction" (30 minutes). It will stop branches being scary.
3. Run the backend and open `http://localhost:8000/docs` (20 minutes). FastAPI
   generates that page from our code — clicking a route and pressing "Try it
   out" is the fastest way to see what a backend actually *is*.

---

## 1. The mental model

There are three programs, not one. They run separately, and they only talk to
each other over the network.

```text
┌──────────────┐   HTTP + JSON   ┌──────────────┐   SQL   ┌──────────────┐
│   FRONTEND   │ ──────────────► │   BACKEND    │ ──────► │   DATABASE   │
│   Next.js    │ ◄────────────── │   FastAPI    │ ◄────── │  PostgreSQL  │
│              │                 │              │         │  (Supabase)  │
│  what people │                 │  the rules   │         │  the facts   │
│     see      │                 │              │         │              │
│  frontend/   │                 │  backend/    │         │  supabase/   │
└──────────────┘                 └──────────────┘         └──────────────┘
```

Each one has exactly one job:

- **The database remembers things.** It does not decide anything. It stores a
  post and refuses to store an invalid one.
- **The backend decides things.** Is this person allowed to post here? Has the
  classifier approved it? It reads and writes the database and answers the
  frontend in JSON.
- **The frontend shows things.** It knows nothing about the database. It asks
  the backend a question, gets JSON back, and draws it.

The single most useful thing to internalise: **the frontend can never touch the
database.** When you want a feed to appear on a page, you are always building
three things — a table, an endpoint, and a component — and they connect in that
order.

Start here:

- **[MDN: Learn web development](https://developer.mozilla.org/en-US/docs/Learn_web_development)**
  — the reference the whole industry uses. You do not read it front to back; you
  come back to it every time you meet a word you don't know.
- **[Roadmap.sh: Full Stack](https://roadmap.sh/full-stack)** — a map of the
  whole territory. Useful for seeing where a topic sits. Do **not** try to learn
  everything on it; it describes a career, not a semester.

---

## 2. Git, and not stepping on each other

Five people on one repository is where student projects usually break, and it
has already bitten us once — two clones of this repo existed on one laptop, one
of them three weeks stale.

- **[Learn Git Branching](https://learngitbranching.js.org/)** — interactive,
  visual, genuinely fun. **Start here.** An hour of this is worth ten hours of
  reading about git.
- **[Atlassian: Feature branch workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow)**
  — exactly the workflow we use: branch off `dev`, do the work, merge back.
- **[Pro Git, chapters 2 and 3](https://git-scm.com/book/en/v2)** — the free
  official book. Chapter 3 (Branching) is the one that matters.
- **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)** —
  a simple naming convention for commit messages, if we want our history
  readable at the end of term.

**Our rules, for reference:** `main` is the graded, working version. `dev` is
where everyone's work comes together. You branch off `dev`, and you merge back
into `dev`. Pull `dev` before you start anything.

---

## 3. The database

Read `supabase/migrations/20260910200000_lynx_core.sql` alongside these. That
file is heavily commented and is the best explanation of our own schema.

**Learn SQL itself:**

- **[PostgreSQL tutorial](https://www.postgresql.org/docs/current/tutorial.html)**
  — official, short, starts from nothing. Chapters 1–3.
- **[PG Exercises](https://pgexercises.com/)** — practice problems against a
  real database in your browser. This is how SQL actually sticks. Two hours here
  is worth any number of tutorials.

**Understand what our schema is doing:**

- **[Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)**
  — our schema pushes rules into the database itself. FR-01 (txstate.edu only)
  and FR-31 (a post has exactly one body type) are `CHECK` constraints, so bad
  data is impossible rather than merely discouraged.
- **[Use The Index, Luke](https://use-the-index-luke.com/)** — why indexes exist
  and why the column order in one matters. Read the first two chapters before
  wondering why our feed indexes look the way they do.
- **[ltree](https://www.postgresql.org/docs/current/ltree.html)** — the extension
  behind `comments.path`. It is how a whole comment thread loads in one query
  instead of a recursive one. This is decision `[D-3]`, which the team still has
  to review.
- **[Full text search](https://www.postgresql.org/docs/current/textsearch.html)**
  — behind FR-80 and FR-81, the `search_vector` columns.

**Supabase specifically:**

- **[Supabase docs](https://supabase.com/docs)** — the hosting layer. It is
  PostgreSQL plus authentication, file storage and an auto-generated API.
- **[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)**
  — **important, and unusual.** RLS is a rule attached to a table saying which
  rows a given user may see. It is what makes FR-90 real: a post still being
  screened is invisible to everyone except its author, enforced by the database
  rather than remembered by our code. If you skip this you will eventually spend
  a whole evening on a query that correctly returns zero rows.
- **[Local development](https://supabase.com/docs/guides/local-development)** —
  how to run Supabase on your own machine so you are not sharing one database.
- **[Migrations](https://supabase.com/docs/guides/deployment/database-migrations)**
  — a migration is a file that changes the database, checked into git like code.
  Never change the shared database by clicking around in a web UI; write a
  migration so everyone else gets the same change.

---

## 4. The backend

Read `backend/main.py`, `backend/models.py` and `backend/schemas.py` alongside
these. It is under a hundred lines total right now, and every idea below is
visible in it.

- **[FastAPI tutorial](https://fastapi.tiangolo.com/tutorial/)** — start at the
  beginning and work down the sidebar. Exceptionally good docs. The first five
  pages will already let you add an endpoint.
- **[FastAPI: SQL databases](https://fastapi.tiangolo.com/tutorial/sql-databases/)**
  — the exact shape of what we are building: a route that reads the database and
  returns JSON.
- **[FastAPI: Bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)**
  — how to split routes into multiple files. We will need this by about week
  six, when `main.py` stops being one file.
- **[SQLAlchemy ORM quickstart](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)**
  — an ORM lets us write Python classes instead of SQL strings. `Profile` in
  `backend/models.py` is one of these, and it mirrors the `profiles` table by
  hand. Use the **2.0** docs; older tutorials online use a different, obsolete
  style.
- **[SQLAlchemy tutorial](https://docs.sqlalchemy.org/en/20/tutorial/)** — the
  longer version, for whoever ends up owning the data layer.
- **[Pydantic models](https://docs.pydantic.dev/latest/concepts/models/)** —
  `ProfileResponse` in `backend/schemas.py`. Pydantic decides the shape of the
  JSON we send out, and validates what comes in. Note that our `ProfileResponse`
  deliberately has no `email` field — that is Pydantic being used as a privacy
  boundary, not an oversight.
- **[uv](https://docs.astral.sh/uv/)** — the tool that installs our Python
  dependencies. It is why `backend/uv.lock` exists.

---

## 5. The frontend

- **[React: Learn](https://react.dev/learn)** — Next.js is built on React, so
  learn React first. "Describing the UI" and "Adding Interactivity" are the two
  sections that matter.
- **[Next.js Learn](https://nextjs.org/learn)** — a free guided course where you
  build a real app. If one person on the team does this end to end, the frontend
  stops being a mystery for everyone.
- **[Next.js docs](https://nextjs.org/docs)** — the reference.
- **[Fetching data](https://nextjs.org/docs/app/getting-started/fetching-data)**
  — specifically how a page asks our backend for data. This is the page that
  connects section 5 back to section 4.
- **[TypeScript handbook](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)**
  — our frontend is TypeScript, and our documentation standard asks for TSDoc
  comments. The first two chapters are enough to be productive.
- **[Tailwind CSS](https://tailwindcss.com/docs/styling-with-utility-classes)**
  — styling with utility classes, if we stay with it.
- **[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)**
  — worth knowing about, not urgent. It handles loading states, caching and
  refetching, which is most of the annoying part of talking to an API. Consider
  it once feeds are working and feel clunky.
- **[three.js docs](https://threejs.org/docs/)** — only if the 3D college
  explorer in our documentation standard is still happening. Budget real time
  for it; it is the single most expensive feature on our list.

---

## 6. The seam — how the two halves actually talk

This is the part nobody teaches and everybody gets stuck on.

- **[MDN: HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)** — GET, POST,
  PATCH, DELETE, and what a request and response are made of.
- **[HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)**
  — 200, 201, 401, 403, 404, 422. Knowing the difference between 401
  (I don't know who you are) and 403 (I know, and no) will save arguments.
- **[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)** —
  **you will hit this in week one.** The frontend runs on port 3000 and the
  backend on 8000, and the browser blocks that by default. The error message is
  famously unhelpful. Read this before you lose an afternoon to it.
- **[API design best practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)**
  — how to name endpoints so they stay predictable. Worth twenty minutes before
  we design more than a couple of routes.

---

## 7. Authentication

Supabase Auth owns our logins. Our database does not store passwords at all —
`profiles.id` points at Supabase's `auth.users(id)`, and that foreign key is the
boundary between what they own and what we own.

- **[Supabase Auth](https://supabase.com/docs/guides/auth)** — start here.
  Whoever owns `feature/supabase-authentication` should read all of it.
- **[Introduction to JWTs](https://jwt.io/introduction)** — the token the
  frontend gets at login and sends with every later request. Understanding this
  explains how the backend knows who is asking.
- **[OWASP Authentication cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)**
  — what to get right. Short and practical.
- **[OWASP Top Ten](https://owasp.org/Top10/)** — the ten most common ways web
  applications get broken. Skim it once; it is the kind of thing that earns
  marks in a report and prevents embarrassment in a demo.

---

## 8. The moderation classifier (FR-90)

This is the most research-heavy feature we have, and the one with an open
decision attached to it (`[D-4]`: what happens when the model does not answer).

- **[Hugging Face: text classification](https://huggingface.co/docs/transformers/tasks/sequence_classification)**
  — what a text classifier is and how to run one. You do not need to train
  anything; using a pre-trained model is entirely legitimate.
- **[Detoxify](https://github.com/unitaryai/detoxify)** — an existing, ready-made
  toxic-comment model. Realistically the fastest route to a working FR-90.
- **[Perspective API](https://perspectiveapi.com/)** — Google's hosted version of
  the same idea. Free, no model to host, but it is a network call on our write
  path — which is exactly what makes `[D-4]` a real decision rather than a
  hypothetical one.

Our `moderation_checks` table already stores the label, the score, the model
version and the latency for every verdict, so whichever we pick, we can measure
it and defend the choice in the final report.

---

## 9. Testing and deploying

Leave these until something works, but do not leave them until the last week.

- **[pytest](https://docs.pytest.org/en/stable/)** — testing the backend.
- **[Playwright](https://playwright.dev/docs/intro)** — testing the app the way a
  person uses it, by driving a real browser.
- **[Deploying Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)** —
  free, and made by the same people as Next.js.
- **[Deploying FastAPI on Render](https://render.com/docs/deploy-fastapi)** —
  a free way to get the backend on the internet.

---

## 10. If you want a structured course instead

Some people learn better from one long ordered path than from a pile of links.
Both of these are free and well regarded.

- **[Full Stack Open](https://fullstackopen.com/en/)** — University of Helsinki.
  Rigorous and genuinely excellent. Its backend is JavaScript rather than
  Python, so parts 0–5 are the relevant ones for us.
- **[The Odin Project](https://www.theodinproject.com/)** — longer and more
  beginner-friendly. Good if HTML and CSS themselves still feel shaky.

Neither is finishable alongside this course. Treat them as a place to go for a
topic, not a commitment.

---

## Suggested split

Nobody should learn all of the above, and trying to is how a semester
disappears. A workable division:

| Area | Sections to own | Everyone else needs |
|---|---|---|
| Database and schema | 3 | Enough SQL to read a query |
| Backend and API | 4, 6 | How to call an endpoint |
| Frontend | 5, 6 | — |
| Auth | 7 | What a JWT is |
| Moderation | 8 | That it sits on the write path |

**Sections 1 and 2 are not optional for anyone.** Everyone needs the mental
model, and everyone needs git.

---

## Adding to this file

If you find something that genuinely helped, add it with a sentence saying what
it explained and, where you can, which file in this repo it made sense of. A
link on its own is not much use to the next person.
