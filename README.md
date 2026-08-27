TXST Social

A Texas State University-focused social networking web application built with a Next.js frontend and FastAPI backend.

Current Stack

Frontend

Next.js

React

TypeScript

Tailwind CSS

ESLint

Backend

Python

FastAPI

uv

Planned

PostgreSQL

SQLAlchemy

Supabase where useful for hosted PostgreSQL, authentication, storage, or realtime features

GSAP for motion and scroll effects

Three.js

React Three Fiber

Drei

Project Structure

txst-social/
├── frontend/     # Next.js application
├── backend/      # FastAPI application
├── .gitignore
└── README.md

Prerequisites

Each developer should have the following installed:

Git

Node.js

npm

Python

uv

VS Code or another editor

Frontend dependency versions are managed by frontend/package.json and frontend/package-lock.json.

Backend dependency versions are managed by backend/pyproject.toml and backend/uv.lock.

Do not install project dependencies globally.

Clone the Repository

git clone https://github.com/PythonSun22/txst-social.git
cd txst-social

Frontend Setup

From the project root:

cd frontend
npm install
npm run dev

The frontend should run at:

http://localhost:3000

Backend Setup

Open a second terminal and, from the project root:

cd backend
uv sync
uv run fastapi dev main.py

The backend should run at:

http://127.0.0.1:8000

The current health-check endpoint is:

http://127.0.0.1:8000/health

Expected response:

{"status":"ok"}

FastAPI development API documentation is available at:

http://127.0.0.1:8000/docs

Development Workflow

Keep the frontend and backend running in separate terminals.

Browser
   ↓
Next.js / React / TypeScript
   ↓ HTTP / JSON
FastAPI / Python
   ↓
PostgreSQL (planned)

Use feature branches rather than working directly on main.

Example:

git checkout -b feature/example-feature

After making changes:

git add .
git commit -m "Describe the change"
git push -u origin feature/example-feature

Then open a pull request on GitHub.

Files That Should Not Be Committed

The repository .gitignore excludes local/generated files such as:

frontend/node_modules/

frontend/.next/

backend/.venv/

.env files

Python cache files

macOS .DS_Store

local VS Code configuration

Never commit passwords, API keys, database credentials, or other secrets.

If environment variables are added later, document required variable names in an .env.example file without including real secret values.

Current Milestone

The initial application foundation is complete:

Next.js frontend runs locally

FastAPI backend runs locally

Frontend successfully calls the FastAPI /health endpoint

Project is tracked as one Git repository

Repository is hosted on GitHub

The next major infrastructure milestone is PostgreSQL integration.