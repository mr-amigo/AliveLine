# AliveLine

**An AI planner for UCU students that tells you *when to start*, not just when it's due.**
AliveLine collects your deadlines, estimates how many hours each assignment needs, and gives every task a work window: a start date and a personal target finish date.

> Live: _coming soon (Render)_ · Screenshot: _added in the final phase_

## Why
Moodle, Google Calendar and Todoist remind you about the **submission date**. That's the wrong signal: a deadline says nothing about how long the work takes, so work slides to the last night. AliveLine counts back from the real deadlines across *all* your assignments and your daily capacity, and shows the day you need to start.

## Features (v1)
- Sign up / sign in (httpOnly cookie session)
- Add assignments manually or import a Moodle calendar (`.ics`)
- AI estimate of hours from the assignment description (Claude), editable by the student
- Work window per assignment + status: **can wait**, **time to start**, **critical**, **done**
- Personal settings: daily capacity (hours/day) and buffer days before deadlines
- Early-access waitlist on the landing page

## Architecture
Single service: FastAPI serves both the JSON API (`/api/*`) and the built React SPA from the same origin, so there is no CORS in production.

```
React (Vite, TS, Tailwind)  ──/api──▶  FastAPI routers ─▶ services ─▶ domain (pure: planner, estimators, importers)
                                                              └──▶ SQLAlchemy models ─▶ SQLite (dev) / Postgres (prod)
```

Full OOAD design (use cases, domain model, planning algorithm, API, phases): [docs/PLAN.md](docs/PLAN.md).
Product one-pager: [docs/ONE_PAGER.md](docs/ONE_PAGER.md).

## Repo layout
```
backend/    FastAPI app (app/core, models, schemas, domain, services, api) + pytest tests
frontend/   React 18 + TypeScript + Vite + Tailwind v4
infra/      Dockerfile (multi-stage), render.yaml (Render Blueprint), docker-compose.yml
docs/       PLAN.md (design), ONE_PAGER.md
```

## Run locally
Requirements: Python 3.12, Node 22.

```bash
# backend → http://localhost:8000 (API docs at /api/docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional; defaults work (SQLite)
uvicorn app.main:app --reload

# frontend → http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install
npm run dev

# tests
cd backend && pytest -q
```

## Run with Docker
```bash
# single container, SQLite inside the container
docker build -f infra/Dockerfile -t aliveline .
docker run -p 8000:8000 -e SECRET_KEY=dev aliveline        # http://localhost:8000

# prod-like: app + Postgres 16
docker compose -f infra/docker-compose.yml up --build
```

## Deploy (Render + Neon)
1. **Neon**: create a free project (region: Frankfurt, `eu-central-1`) and copy the connection string (`postgresql://…?sslmode=require`). `postgres://` / `postgresql://` URLs are converted to the psycopg driver automatically.
2. **Render**: New → Blueprint → pick this repo → set **Blueprint Path** to `infra/render.yaml`. Fill in `DATABASE_URL` (from Neon) and optionally `ANTHROPIC_API_KEY`. `SECRET_KEY` is generated for you.
3. Open `https://<service>.onrender.com` and sign up. Tables are created on first start.

Note: the free Render tier sleeps after 15 minutes idle, so the first request after that takes around 50 seconds.

## Environment variables
| Variable | Default | Description |
|---|---|---|
| `ENV` | `dev` | `prod` refuses to start with the default `SECRET_KEY` |
| `SECRET_KEY` | dev placeholder | JWT signing key. **Required in prod** |
| `DATABASE_URL` | `sqlite:///./aliveline.db` | SQLAlchemy URL; Neon/Postgres URLs accepted as-is |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS (Render) |
| `APP_TZ` | `Europe/Kyiv` | Time zone for day-based planning |
| `ANTHROPIC_API_KEY` | empty | Enables Claude estimates; heuristic fallback without it |
| `PORT` | `8000` | Port the container listens on (set by Render) |

## Team
Artem Serhiichuk · Ostap Sukhomlyn · Andrii Antoniuk. OOAD course, Ukrainian Catholic University.
