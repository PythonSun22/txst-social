# Boko Lynx

A Texas State University-focused social networking web application built with a Next.js frontend, FastAPI backend, and PostgreSQL database hosted through Supabase.

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
  - Authentication planned
  - Storage may be used later

### Planned

- Supabase Auth
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