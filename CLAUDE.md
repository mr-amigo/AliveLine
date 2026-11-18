# AliveLine — project guide for Claude

AI planner for UCU students: collects deadlines, estimates hours per assignment (AI),
computes a **work window** (start date + target finish) and status
(`can_wait` / `time_to_start` / `critical` / `done`). Tells students **when to start**, not when it's due.

Full design (domain model, API, algorithm, phases): **docs/PLAN.md**. Product one-pager: docs/ONE_PAGER.md.

## Session workflow (token budget is tight — Claude Pro)
1. Open docs/PLAN.md → find first unchecked phase in "Phases". Read only the sections that phase references.
2. Do ONLY that phase. Don't explore the repo broadly — structure is documented below.
3. Write each file once, completely; avoid many small edits. No speculative features.
4. Run only the tests relevant to the phase (`cd backend && pytest -q tests/test_x.py`).
5. At end: tick boxes in PLAN.md, add one line to "Progress log", commit (Conventional Commits).
6. User runs `/clear` between phases.

## Stack (fixed — don't change without asking)
- backend/: Python 3.12, FastAPI, SQLAlchemy 2 (sync), Pydantic v2 + pydantic-settings, PyJWT, bcrypt,
  icalendar, anthropic SDK. pip + requirements.txt. Tests: pytest + FastAPI TestClient on SQLite.
- frontend/: React 18 + TypeScript + Vite + Tailwind v4 (`@tailwindcss/vite`) + react-router-dom. No other UI/state libs.
- infra/: CloudFormation (backend-ecr, backend, frontend) + Dockerfile.lambda; Makefile `make aws-*`. Also all-in-one Dockerfile + docker-compose.yml for local.
- Prod: AWS us-east-1 — CloudFront (S3 SPA + `/api/*` → Lambda function URL, FastAPI via Mangum) + Aurora Serverless v2 Postgres. Local: SQLite by default.

## Layout
```
backend/app/
  main.py            app factory; mounts /api routers; serves frontend dist with SPA fallback
  core/              config.py (Settings), db.py (engine, SessionLocal, Base), security.py (hash, JWT), deps.py (get_db, current_user)
  models/            SQLAlchemy entities: user.py, course.py, assignment.py, waitlist.py
  schemas/           Pydantic DTOs (request/response), never return ORM objects directly
  domain/            PURE logic, no FastAPI/SQLAlchemy imports:
                     planner.py (WorkWindowPlanner), estimation/ (Estimator strategy), importers/ (AssignmentSource adapters)
  services/          use-case orchestration: auth, assignments, imports, plan
  api/               thin routers: auth, assignments, imports, settings, waitlist, health
backend/tests/
frontend/src/
  api/ (client.ts, types.ts)  auth/ (AuthContext, RequireAuth)  pages/  components/
infra/  backend-ecr.yaml backend.yaml frontend.yaml Dockerfile.lambda Dockerfile docker-compose.yml
Makefile  aws-* deploy targets
```

## Conventions
- Layers: `api → services → domain + models`. Routers hold no business logic. Domain is unit-testable alone.
- All API under `/api`. JSON snake_case. Datetimes ISO-8601 UTC; planning by calendar day in `APP_TZ` (Europe/Kyiv).
- Auth: JWT in httpOnly cookie `al_session` (SameSite=Lax, Secure in prod). Same origin → no CORS in prod; Vite proxies `/api` in dev.
- Work windows/statuses are **computed on read**, never stored.
- Errors: `HTTPException` with short `detail`; frontend shows `detail`. Never use 403 (CloudFront maps 403 → SPA index.html).
- Type hints everywhere; small functions; docstring only where intent isn't obvious.
- Secrets only via env (`SECRET_KEY`, `DATABASE_URL`, `COOKIE_SECURE`; AWS keys in root `.env` for make). Never commit `.env` or `example/`.
- Shared AWS account: only create/modify `aliveline-*` resources; never touch onetwothree/`meetings-*`.
- When implementing the Claude estimator, load the `claude-api` skill first. Claude via **Amazon Bedrock** (`AnthropicBedrock`), model `us.anthropic.claude-haiku-5-5`, runs only in the AI Lambda (PLAN §5).
- When building UI pages, load `frontend-design` skill once (phase 7), keep the design tokens in PLAN.md §8.

## Commands
```
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload            # http://localhost:8000
pytest -q
cd frontend && npm install && npm run dev  # http://localhost:5173 (proxies /api → :8000)
docker build -f infra/Dockerfile -t aliveline . && docker run -p 8000:8000 -e SECRET_KEY=dev aliveline
make aws-deploy                          # full AWS deploy; make help lists aws-* targets
```
