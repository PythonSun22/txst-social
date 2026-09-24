# Independent local testing — Boko Lynx

Each teammate runs their own Supabase database, Auth, and Storage on their
computer. Test feature-branch migrations locally, then open a PR. **Every merge
requires two approvals.** The shared database changes only after review and merge.

## 1. Start local Supabase

Install and start **Docker Desktop**, and install the **Supabase CLI** using the
[official setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started).
Use the app prerequisites in [README.md](../README.md) for Node.js, Python and `uv`.

Check out your feature branch. From the repository root:

```sh
supabase start
supabase status
```

The first start downloads containers and applies the migrations in your checkout.
It creates a fresh local environment; it does not copy shared accounts or data.
This repository already contains `supabase/config.toml`, so no `supabase init`,
cloud login, or `supabase link` is needed.

## 2. Connect both apps to your local instance

Keep your existing remote settings privately backed up. Use the URLs and keys
printed by `supabase status`; never commit real `.env` files.

In **`backend/.env`**:

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:LOCAL_DB_PASSWORD@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=LOCAL_PUBLISHABLE_OR_ANON_KEY
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Replace the placeholders with your local values. Copy the database URL from
`supabase status`, changing its `postgresql://` prefix to `postgresql+psycopg://`.

In **`frontend/.env.local`**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=LOCAL_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Use the local **publishable key** or legacy **anon key** in both apps, never the
secret/service-role key. `.env.local` overrides frontend `.env`; check it when
switching environments. Restart both apps after changing settings.

## 3. Run and test

In one terminal:

```sh
cd backend
uv sync
uv run fastapi dev main.py
```

In another:

```sh
cd frontend
npm ci
npm run dev
```

Open the **local Studio URL** from `supabase status` (normally
`http://127.0.0.1:54323`). In Authentication → Users, create a test user with an
`@txstate.edu` email, a test-only password, and email confirmation enabled.
The Auth trigger creates its profile automatically (FR-01/FR-02); do not insert
credentials or edit mirrored email fields in `profiles`.

Visit `http://localhost:3000/login` and sign in. Check
`http://127.0.0.1:8000/db-health`. For the image feature, visit `/upload-test`,
upload an image, refresh, and open its saved preview. Use a second local account
to check that private uploads remain isolated.

## 4. Daily migrations and branch changes

Create schema changes as migration files; update `backend/models.py` alongside them:

```sh
supabase migration new describe_your_change
# Edit the generated SQL, then apply pending migrations locally:
supabase migration up --local
```

Git branch switching **does not switch or rewind your local database**. To rebuild
it from the current branch's migrations:

```sh
supabase db reset --local
```

**Reset deletes local database data, including test accounts.** Recreate them
afterward. Do not add `--linked` or a remote `--db-url`. The repository currently
has no `supabase/seed.sql`; a missing-seed warning means there are no extra fixtures.
General and college rows are already seeded by migrations.

Use `supabase stop` when finished and `supabase start` to resume. Each teammate's
machine is independent; multiple checkouts on one machine share the configured
project ID/ports unless deliberately configured otherwise.

## 5. Review and share

Commit code, migrations, model changes and relevant documentation; open a PR to
`dev` with your test results. Obtain **two approvals before merging**. After merge,
coordinate one application of the migration to the shared database. Teammates
update from `dev` and apply the new migrations locally.

For this local workflow, use `migration up --local` or `db reset --local`, **not
`supabase db push`**, which is intended for a remote deployment.
[Supabase CLI workflow reference](https://supabase.com/docs/guides/local-development/cli-workflows)

If startup fails, check that Docker is running and the configured ports are free.
The checked-in config currently uses PostgreSQL 17, while older project notes say
16; confirm the shared server version before relying on version-specific behavior.
