# AliveLine

**An AI planner for UCU students that tells you *when to start*, not just when it's due.**
AliveLine collects your deadlines, estimates how many hours each assignment needs, and gives every task a work window: a start date and a personal target finish date.

> Live: **https://d2b7fp4wgl1dok.cloudfront.net** · Screenshot: _added in the final phase_

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
One origin for the site and the API, so the httpOnly session cookie works without CORS.

```
Browser ──HTTPS──▶ CloudFront ──/*──────▶ S3 (React SPA: Vite, TS, Tailwind)
                             └──/api/*──▶ Lambda function URL: FastAPI (Mangum) ─▶ Aurora Serverless v2 PostgreSQL (private VPC)

FastAPI: routers ─▶ services ─▶ domain (pure: planner, estimators, importers) + SQLAlchemy models
```
Locally (and in `infra/Dockerfile`), FastAPI serves the built SPA itself, with SQLite or Postgres.

Full OOAD design (use cases, domain model, planning algorithm, API, phases): [docs/PLAN.md](docs/PLAN.md).
Product one-pager: [docs/ONE_PAGER.md](docs/ONE_PAGER.md).

## Repo layout
```
backend/    FastAPI app (app/core, models, schemas, domain, services, api) + pytest tests
frontend/   React 18 + TypeScript + Vite + Tailwind v4
infra/      CloudFormation (backend-ecr, backend, frontend), Dockerfile.lambda, Dockerfile (all-in-one), docker-compose.yml
Makefile    make aws-* deployment targets (`make` lists them)
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

## Deploy (AWS)
Everything is CloudFormation in `infra/`, driven by the `Makefile`; region `us-east-1`.
Needs: AWS CLI v2, Docker with buildx, Node 22.

1. `cp .env.example .env` and fill in `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BUDGET_EMAIL` (a $5/month budget alert).
2. `make aws-deploy`. It creates the ECR repo, pushes the Lambda image (tagged with the commit), deploys VPC + Aurora + Lambda (the first run takes about 10 minutes), creates tables, deploys S3 + CloudFront, then uploads the SPA.
3. `make aws-url` prints the site URL (`https://<id>.cloudfront.net`). Open it and sign up.

After code changes: `make aws-push aws-backend` (backend) or `make aws-publish` (frontend). Useful: `make aws-health`, `make aws-logs`, `make aws-destroy`.

Cost: close to $0 when idle. Lambda and CloudFront (flat-rate Free plan) are free at this scale; Aurora pauses after 5 idle minutes, so you pay only for storage plus 2 secrets (about $1/month). The first request after a pause takes about 15 s while Aurora resumes. If the account can't use the CloudFront Free plan (e.g. AWS Free Tier accounts), deploy with `make aws-deploy CLOUDFRONT_PLAN=PAY_AS_YOU_GO`.

## Environment variables
| Variable | Default | Description |
|---|---|---|
| `ENV` | `dev` | `prod` refuses to start with the default `SECRET_KEY` |
| `SECRET_KEY` | dev placeholder | JWT signing key. **Required in prod**; on AWS, generated in Secrets Manager |
| `DATABASE_URL` | `sqlite:///./aliveline.db` | SQLAlchemy URL; `postgres://` URLs accepted as-is. On AWS, built from the Aurora secret |
| `DB_NULL_POOL` | `false` | `true` on Lambda: no pooled connections, so Aurora can pause |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS (set on AWS) |
| `APP_TZ` | `Europe/Kyiv` | Time zone for day-based planning |
| `BEDROCK_MODEL` | empty | Claude model on Bedrock (`us.anthropic.claude-haiku-5-5`), set on the AI Lambda; heuristic estimates without it (phase 5) |
| `PORT` | `8000` | Port of the all-in-one container |

## Team
Artem Serhiichuk · Ostap Sukhomlyn · Andrii Antoniuk. OOAD course, Ukrainian Catholic University.
