# TXST Lynx

A Texas State University-focused social networking web application built with a Next.js frontend, FastAPI backend, and PostgreSQL database hosted through Supabase.

For independent feature-branch testing, follow the
[local development guide](docs/local-development.md). It covers local Supabase,
test accounts, migrations, and the team's two-approval merge workflow.

## Current Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- ESLint

### Backend

- Python
- FastAPI
- SQLAlchemy
- psycopg
- python-dotenv
- uv

### Database / Services

- PostgreSQL
- Supabase
  - Hosted PostgreSQL
  - Database migrations
  - Authentication foundation: existing-account sign-in and backend identity
  - Private image storage through the `/upload-test` pipeline

### Planned

- Supabase signup and account recovery UI
- GSAP for motion and scroll effects
- Three.js
- React Three Fiber
- Drei

## Project Structure

```text
txst-social/
├── frontend/              # Next.js application
├── backend/               # FastAPI application
│   ├── main.py            # FastAPI app and endpoints
│   ├── database.py        # PostgreSQL connection and DB sessions
│   ├── models.py          # SQLAlchemy database models
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── .env.example       # Environment variable template
│   ├── pyproject.toml
│   └── uv.lock
├── supabase/
│   ├── config.toml
│   └── migrations/        # Version-controlled SQL migrations
├── .gitignore
└── README.md
```

## Prerequisites

Each developer should have the following installed:

- Git
- Node.js
- npm
- Python
- uv
- VS Code or another editor

Developers working with database migrations should also install:

- Supabase CLI

Frontend dependency versions are managed by:

```text
frontend/package.json
frontend/package-lock.json
```

Backend dependency versions are managed by:

```text
backend/pyproject.toml
backend/uv.lock
```

Do not install project dependencies globally.

## Clone the Repository

Clone the repository only once.

Afterward, use Git pull to retrieve updates:

## Frontend Setup

From the project root:

```bash
cd frontend
npm install
npm run dev
```

The frontend should run at:

```text
http://localhost:3000
```

For normal development after dependencies are installed:

```bash
cd frontend
npm run dev
```

Run `npm install` again after pulling if frontend dependencies have changed.

## Backend Setup

Open a second terminal and, from the project root:

```bash
cd backend
uv sync
```

`uv sync` installs the backend dependencies recorded in `pyproject.toml` and `uv.lock`.

Developers should not run `uv add` unless intentionally adding a new dependency to the project.

Current backend database dependencies include:

- SQLAlchemy
- psycopg
- python-dotenv

## Backend Environment Setup

The backend requires a PostgreSQL connection string.

From the `backend` directory:

```bash
cp .env.example .env
```

The local `.env` file requires:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/postgres
```

The project currently uses the Supabase PostgreSQL Session Pooler.

Obtain the real database connection information privately from a team member with access to the Supabase project.

Never commit the real `.env` file.
```

## Run the Backend

From the `backend` directory:

```bash
uv run fastapi dev main.py
```

The backend should run at:

```text
http://127.0.0.1:8000
```

FastAPI development documentation is available at:

```text
http://127.0.0.1:8000/docs
```

## Current API Endpoints

### Authentication foundation (FR-01, FR-02, FR-96)

Copy `frontend/.env.example` to `frontend/.env.local`, and add the new entries
from `backend/.env.example` to your backend `.env`. Use the same Supabase project
for both apps and `DATABASE_URL`. Only a **publishable key** (or legacy anon key)
belongs in these Auth settings; never put a service-role or secret key in a
`NEXT_PUBLIC_` variable. Restart the frontend after changing its environment.

Open `/login` and sign in with an existing Texas State email/password account.
Supabase's browser SDK manages session persistence and refresh. Passwords go
directly to Supabase Auth. The browser uses Supabase for Auth and signed image
transfers; application records continue through FastAPI. Account signup/reset UI is not part of this
foundation stage.

`GET /auth/me` accepts `Authorization: Bearer <access token>`. FastAPI asks the
configured project's `/auth/v1/user` endpoint to validate the token and uses
the returned UUID to load `profiles`. Its response includes public profile
fields plus `email_verified`; it never accepts an author ID from the client.
Missing/invalid tokens return 401, disallowed accounts return 403, and Auth
configuration/service failures return 503. Unverified active users can inspect
their identity, but `require_verified_profile` rejects them for future writes.
Space-specific bans must additionally be checked when post routes are added.

The existing backend database connection must be authorized to read profiles.
It is a trusted server connection: passing a bearer token to FastAPI does not
change its SQL role or set `auth.uid()`. Application authorization is enforced
explicitly. No browser profile-read policy or database migration is added here.
The migrations' signup trigger must have created the account's profile; the API
does not create missing profiles or write mirrored email/verification fields.

`FRONTEND_ORIGINS` is a comma-separated allowlist for browser API requests and
defaults to the two local development origins in `.env.example`.

Run the isolated backend tests from `backend/`:

```bash
uv run python -m unittest discover -s tests -v
```

These tests mock Supabase Auth and database access. For a live smoke test, sign
in, verify the username/verification state on `/login`, refresh, and sign out.
The current stage has no post endpoints; persistent posts and media follow next.

### Image upload test (FR-02, FR-32, FR-90)

Open `/upload-test` from the **Upload test** navigation link. The page accepts
one JPEG, PNG, or WebP up to 10 MB (10,000,000 bytes), displays its dimensions
and aspect ratio, and enables upload for verified students when validation passes.
Original bytes and aspect ratio are preserved; cropping comes later.

Before testing persistence, apply
`supabase/migrations/20260924191615_image_upload_pipeline.sql` with the normal
`supabase db push` workflow. It creates `image_uploads`, the private
`post-images` Storage bucket, and ownership policies. Use the same Supabase
project in both `.env` files and `DATABASE_URL`; no new environment variables
or service-role key are required. Restart FastAPI to load the new routes.

The pipeline exposes `GET /images/policy`, `POST /images`,
`POST /images/{id}/complete`, `GET /images`, and `GET /images/{id}/preview`.
Image bytes go directly from browser to Storage. PostgreSQL stores metadata;
completed uploads are private and do not create or approve posts.

See [Image upload pipeline](docs/image-uploads.md) for architecture, manual
checks, limits, cleanup considerations and future post integration.

### Health Check

```text
GET /health
```

URL:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

This confirms that FastAPI is running.

### Database Health Check

```text
GET /db-health
```

URL:

```text
http://127.0.0.1:8000/db-health
```

Example response:

```json
{
  "database": "connected",
  "profile_count": 0
}
```

This confirms that FastAPI can communicate with PostgreSQL.

### Profiles

```text
GET /profiles
```

URL:

```text
http://127.0.0.1:8000/profiles
```

This retrieves profiles from PostgreSQL through the SQLAlchemy `Profile` model.

Profile creation, editing, and authenticated profile access are not implemented yet.

```json
[]
```

## Database

PostgreSQL is hosted through Supabase.

The current architecture is:

```text
Browser
   ↓
Next.js / React / TypeScript
   ↓ HTTP / JSON
FastAPI / Python
   ↓
SQLAlchemy
   ↓
psycopg
   ↓
Supabase PostgreSQL
```

Application database access should go through FastAPI rather than directly from the frontend.

### Current Schema

The current application database contains:

```text
public.profiles
```

Supabase provides its own authentication table:

```text
auth.users
```

The relationship is:

```text
auth.users
    │
    │ id
    ▼
public.profiles
```

The same UUID will identify the authenticated Supabase account and the user's TXST Lynx profile.

Current profile fields include:

- id
- username
- display_name
- bio
- college
- major
- profile_image_url
- created_at
- updated_at

## Supabase CLI Setup

Developers making database schema changes should log into Supabase:

```bash
supabase login
```

Then link the local repository to the TXST Lynx Supabase project:

```bash
supabase link --project-ref owanzsbfjzogitabmydg
```

This generally only needs to be done once per local setup.

## Database Migrations

Database schema changes should be stored as migration files under:

```text
supabase/migrations/
```

Create a migration:

```bash
supabase migration new migration_name
```

Example:

```bash
supabase migration new add_posts
```

Preview the migration before applying it:

```bash
supabase db push --dry-run
```

Apply migrations:

```bash
supabase db push
```

Migration files should be committed to Git so database changes remain version-controlled.

## Backend Organization

### `database.py`

Handles:

- Loading `DATABASE_URL`
- Connecting SQLAlchemy to PostgreSQL
- Creating database sessions
- Providing `get_db()` to FastAPI endpoints

### `models.py`

Contains SQLAlchemy models that map PostgreSQL tables to Python classes.

Current model:

```text
Profile ↔ public.profiles
```

### `schemas.py`

Contains Pydantic models that define the JSON data FastAPI accepts and returns.

Current schemas include:

```text
ProfileCreate
ProfileResponse
```

### `main.py`

Contains the FastAPI application and current API endpoints.

## Current Development Pipeline

The following connections are currently working:

```text
Next.js
   ↓
FastAPI
   ↓
SQLAlchemy
   ↓
PostgreSQL
```

Completed:

- Next.js frontend runs locally
- FastAPI backend runs locally
- Frontend successfully calls FastAPI
- Supabase PostgreSQL database configured
- Supabase migration workflow configured
- Initial `profiles` table created
- FastAPI connected to PostgreSQL
- SQLAlchemy configured
- Database sessions configured
- SQLAlchemy `Profile` model created
- Pydantic profile schemas created
- `/db-health` verifies PostgreSQL connectivity
- `/profiles` reads profile data from PostgreSQL

## Next Milestone

The next major milestone is authentication and the complete profile pipeline:

```text
Next.js
   ↓
Supabase Auth
   ↓
Access Token
   ↓
FastAPI verifies user
   ↓
Profile API
   ↓
SQLAlchemy
   ↓
PostgreSQL
   ↓
FastAPI Response
   ↓
Next.js Profile Page
```

Planned profile endpoints include:

```text
POST  /profiles/me
GET   /profiles/me
PATCH /profiles/me
```

Remaining profile-pipeline work includes:

- Supabase authentication
- FastAPI token verification
- Authenticated profile creation
- Authenticated profile retrieval/editing
- Next.js profile API integration
- CORS configuration if required

## Development Workflow

Keep the frontend and backend running in separate terminals.

Use the following Git workflow:

```text
feature branch
      ↓
Pull Request
      ↓
dev
      ↓
stable milestone
      ↓
main
```

Do not work directly on `main`.

Before starting a new feature:

```bash
git checkout dev
git pull
git checkout -b feature/example-feature
```

After making changes:

```bash
git add .
git commit -m "Describe the change"
git push -u origin feature/example-feature
```

Then open a pull request targeting `dev`.

## Dependency Workflow

If a new frontend dependency is intentionally added:

```bash
npm install package-name
```

This updates `package.json` and `package-lock.json`.

Other developers only need:

```bash
npm install
```

If a new backend dependency is intentionally added:

```bash
uv add package-name
```

This updates `pyproject.toml` and `uv.lock`.

Other developers only need:

```bash
uv sync
```

## Files That Should Not Be Committed

The repository `.gitignore` excludes local/generated files such as:

```text
frontend/node_modules/
frontend/.next/
backend/.venv/
.env files
Python cache files
.DS_Store
local editor configuration
```

Never commit:

- Passwords
- API secrets
- Database credentials
- Private environment variables

Use `.env.example` to document required environment variable names without including real secret values.

## Current Milestone

The initial application and database foundations are complete:

- Next.js frontend works
- FastAPI backend works
- Frontend and backend communicate
- PostgreSQL is hosted through Supabase
- FastAPI and PostgreSQL communicate through SQLAlchemy
- Initial profile database model is implemented
- Profile data can be retrieved through FastAPI
- Database migrations are version-controlled

The next major milestone is Supabase authentication and the authenticated user-profile pipeline.
