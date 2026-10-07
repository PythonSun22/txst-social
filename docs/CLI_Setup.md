# How to setup Docker and supabase CLI to test local development

Step 1: Install <b>Docker Desktop</b> into your PC and keep it open.

Step 2: To setup CLI, go to your terminal. In your repo root, type `npx --yes supabase@latest start`.

If you go back to Docker, you will see your local database instance running.

Step 3: In your terminal, run `npx --yes supabase@latest status`

You will see different URLs and keys. Do not close that terminal yet.

Step 4: Copy and paste these into your backend/.env, fill the required entries shown as <..> with the URLs and keys obtained from step 3:

    DATABASE_URL=postgresql+psycopg://<Database URL after postgresql://>
    SUPABASE_URL=http://127.0.0.1:54321
    SUPABASE_PUBLISHABLE_KEY=<Authentication Keys Publishable, starts with  sb_publishable>
    SUPABASE_SECRET_KEY=<Authentication Keys Secret, starts with sb_secret>
    MODERATION_ENABLED=true
    FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

    OPENAI_API_KEY= <Use the same OPENAI_API_KEY>

    MODERATION_CONTEXT_RECHECK_ENABLED=true

<mark> Make sure to comment out the URLs for shared database in your .env file </mark>

Step 5: Copy and Paste these lines into your frontend/.env:

    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Authentication Keys Publishable, starts with  sb_publishable>
    NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

Step 6: <b>Important:</b>

After pulling new migration files or creating a new migration, run `npx --yes supabase@latest migration up --local` from the repo root.It will update your local database to match your shared one if it was upadated and apply your local migration changes into the local database.

Step 7: You can now run your frontend and backend with your local database configured.
