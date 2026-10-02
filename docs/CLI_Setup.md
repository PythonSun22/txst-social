### How to setup Docker and supabase CLI

Step 1: Install <b>Docker Desktop</b> into your PC and keep it open.

Step 2: To setup CLI, go to your terminal. In your repo root, type `npx --yes supabase@latest start`.

Go to your Docker and you will see your local database instance running.

Step 3: In your terminal, run `npx --yes supabase@latest status`

You will see different URLs and keys. Do not close that terminal yet

Step 4: Copy and paste these into your backend/.env, fill the required entries shown as <..> with the URLs and keys obtained from step 3:

    DATABASE_URL=postgresql+psycopg://<Database URL after postgresql://>
    SUPABASE_URL=http://127.0.0.1:54321
    SUPABASE_PUBLISHABLE_KEY=<Authentication Keys Publishable, starts with  sb_publishable>
    SUPABASE_SECRET_KEY=<Authentication Keys Secret, starts with sb_secret>
    MODERATION_ENABLED=true
    FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

    OPENAI_API_KEY= <Use the same OPENAI_API_KEY>

    MODERATION_CONTEXT_RECHECK_ENABLED=true

<mark> Make sure to comment out the URLs in your .env file you use for shared database </mark>

Step 5: Copy and Paste these lines into your frontend/.env:

    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Authentication Keys Publishable, starts with  sb_publishable>
    NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

Step 6: Go to your terminal and run `supabase migration up --local`.

\*\*\* Important:

## Continued setup: notes and Steps 7–10

### Important notes

- Step 6 uses the same temporary CLI as Steps 2 and 3. From the repo root, run `npx --yes supabase@latest migration up --local`. A plain `supabase` command only works if you installed the CLI globally. The first `start` may already have applied every migration; a message saying none are pending is fine.
- Keep `--local` on migration commands for your own Docker database. Do not use `supabase db push` for this setup: that command is for a linked remote project. You do not need `supabase login`, `supabase link`, or `supabase init` because this repo already has `supabase/config.toml`.
- In `DATABASE_URL`, copy the full database URL from `status` and change only `postgresql://` to `postgresql+psycopg://`. Replace every `<...>` placeholder with a real local value. Keep local and shared database settings separate, and never commit `.env` files or paste secret keys into a chat or issue.
- If `frontend/.env.local` exists, its values override `frontend/.env`. Make sure the frontend and backend both point to the same local Supabase instance. Restart both apps after changing environment files.
- The moderation settings in Step 4 are optional for basic local database testing. `MODERATION_ENABLED=true` requires the automatic moderation migration, a working backend-only OpenAI key, and the local Supabase secret key. `MODERATION_CONTEXT_RECHECK_ENABLED=true` is an experimental local text setting; leave it false for ordinary testing and shared environments. Keep `OPENAI_API_KEY` and `SUPABASE_SECRET_KEY` only in `backend/.env`. Local image posts may remain pending because OpenAI cannot fetch a signed `127.0.0.1` image URL; see [moderation.md](moderation.md).
- `@latest` can select a different CLI version later. If the team commits a root `package.json` and `package-lock.json` with a pinned Supabase CLI, run `npm ci` at the repo root and use `npx supabase ...` without `@latest`.

Step 7: Start the backend in a new terminal:

```powershell
cd backend
uv sync
uv run fastapi dev main.py
```

Step 8: Start the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Step 9: Open `http://127.0.0.1:8000/db-health` to check the database connection, then open `http://localhost:3000`. Use the Studio URL shown by `status` to create a local test user with a `@txstate.edu` email and confirmed email status. Sign in through `/login` to test authenticated profile and post routes. The local user and data are separate from the shared project.

Step 10: After pulling new migration files or switching branches, run `npx --yes supabase@latest migration up --local` again. To stop the local services without deleting their data, run `npx --yes supabase@latest stop`. Avoid `db reset --local` unless you intend to erase local test accounts and data.

For more detail about local setup and branch changes, see [local-development.md](local-development.md) and the [Supabase CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started).
