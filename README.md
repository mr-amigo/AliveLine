# AliveLine

[![CI](https://github.com/mr-amigo/AliveLine/actions/workflows/ci.yml/badge.svg)](https://github.com/mr-amigo/AliveLine/actions/workflows/ci.yml)

**An AI planner for UCU students that tells you *when to start*, not just when it's due.**
AliveLine collects your deadlines, estimates how many hours each assignment needs and gives every task a work window: a start date and a personal target finish date.

> Live: **https://d2b7fp4wgl1dok.cloudfront.net**

![AliveLine planner: week view with work blocks per assignment, deadlines on top and a "won't fit" indicator](docs/img/screenshot.png)

## Why
Moodle, Google Calendar and Todoist remind you of the **submission date**. That is the wrong signal: a deadline says nothing about how long the work takes, so the work slides to the last night. AliveLine plans backwards from the real deadlines of *all* your assignments and your daily capacity, and shows the day you need to start.

## Features
- Sign up / sign in (httpOnly cookie session).
- Add assignments by hand or import a Moodle calendar export (`.ics`).
- Hour estimates: a rough estimate (heuristic) for every assignment, or an AI estimate from the description (OpenAI), always editable.
- AI steps: splits a big assignment into 2–4 steps that the planner schedules in order.
- Work window and status per assignment: **can wait**, **time to start**, **critical**, **done**; assignments that can't be finished in time are flagged **at risk** with the missing hours.
- Views: Day, 3 days, Week, Month and List. Work blocks are sized by hours; deadlines have their own row.
- Planning settings: hours per weekday (days off included), buffer days before deadlines, longest and shortest session, interleaving tasks.
- Plans: **Free** keeps the whole planner and the first AI estimate of each assignment; **Pro** ($3/month or $24/year, via Paddle) adds AI steps, re-estimates and "Estimate all with AI". Each Pro feature has 3 free trial uses.
- Landing page with pricing and an early-access waitlist; Privacy, Terms and Refund pages.

## Architecture
The site and the API share one origin, so the httpOnly session cookie works without CORS.

```
Browser ──HTTPS──▶ CloudFront ──/*─────────▶ S3 (React SPA: Vite, TS, Tailwind)
                             ├──/api/ai/*──▶ AI Lambda (outside VPC) ─▶ OpenAI gpt-4.1-mini, Paddle API
                             └──/api/*─────▶ Lambda function URL: FastAPI (Mangum) ─▶ Aurora Serverless v2 PostgreSQL (private VPC)

FastAPI: routers ─▶ services ─▶ domain (pure: planner, estimators, importers, billing) + SQLAlchemy models
```
- **Work windows are computed on read** by `WorkWindowPlanner`: earliest deadline first, each task placed as late as possible within your hours per day minus buffer days, so close deadlines get today and distant ones wait. Hours that don't fit make the assignment *at risk*.
- **Estimation is a Strategy** (`OpenAIEstimator`, `HeuristicEstimator` as fallback); **imports are Adapters** (`IcsSource`, `MoodleApiSource` stub) behind `AssignmentSource`.
- The AI Lambda runs outside the VPC, so it reaches OpenAI and Paddle without a NAT gateway ($0 idle). The browser first gets a short-lived claim from the backend (plan and monthly limit checked), calls the AI Lambda with it, then saves the estimate with the assignment.
- Payments: Paddle Billing is the merchant of record. Its webhook (`/api/billing/webhook`, HMAC-signed) switches the plan.
- Both Lambdas use the same image, tagged with the git commit. CI (GitHub Actions) runs `pytest` and the SPA build on every push.

Locally (and in `infra/Dockerfile`), FastAPI serves the built SPA itself, with SQLite or Postgres.

## Repo layout
```
backend/    FastAPI app (app/core, models, schemas, domain, services, api) + pytest tests
frontend/   React 18 + TypeScript + Vite + Tailwind v4
infra/      CloudFormation (backend-ecr, backend, ai, frontend), Dockerfile.lambda, Dockerfile (all-in-one), docker-compose.yml
Makefile    make aws-* deployment targets (`make` lists them)
docs/img/   README screenshot
.github/    CI workflow (pytest + npm run build)
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
# one container, SQLite inside it
docker build -f infra/Dockerfile -t aliveline .
docker run -p 8000:8000 -e SECRET_KEY=dev aliveline        # http://localhost:8000

# production-like: app + Postgres 16
docker compose -f infra/docker-compose.yml up --build
```

## Deploy (AWS)
Everything is CloudFormation in `infra/`, driven by the `Makefile`; region `us-east-1`.
Needs AWS CLI v2, Docker with buildx and Node 22.

1. `cp .env.example .env` and fill in `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BUDGET_EMAIL` (for a $5/month budget alert) and, optionally, `OPENAI_API_KEY` (AI estimates) and the `PADDLE_*` keys (payments).
2. `make aws-deploy`. It creates the ECR repository, pushes the Lambda image (tagged with the commit), deploys VPC + Aurora + backend Lambda (the first run takes about 10 minutes), creates the tables, deploys the AI Lambda and S3 + CloudFront, then uploads the SPA.
3. `make aws-url` prints the site URL (`https://<id>.cloudfront.net`). Open it and sign up.

After code changes: `make aws-push aws-backend aws-ai` (backend) or `make aws-publish` (frontend). Also useful: `make aws-health`, `make aws-logs`, `make aws-ai-logs`, `make aws-destroy`.

Ops (Aurora is private, so these invoke the backend Lambda directly):
- `make aws-stats` → `{"waitlist", "users", "returning_users", "assignments"}`; a returning user has signed in on at least 2 different days (Kyiv time).
- `make aws-delete-user EMAIL=...` removes an account and all its data.
- `make aws-grant-pro EMAIL=... [DAYS=30]` gives Pro by hand (`DAYS=0` takes it back).

### Cost
| Item | Idle | Notes |
|---|---|---|
| CloudFront + S3 | $0 | flat-rate Free plan, WAF rate limit included |
| 2 Lambdas | $0 | free tier covers this scale |
| Aurora Serverless v2 | ~$0.10/GB-month storage | min 0 ACU, pauses after 5 idle minutes; ~$0.12/ACU-hour while awake |
| Secrets Manager | $0.80 | 2 secrets |
| OpenAI gpt-4.1-mini | ~$0.001 per estimate | only when a student asks for an AI estimate |

About **$1/month** idle, with a $5/month AWS Budget alert. The first request after a pause takes about 15 s while Aurora resumes (the UI shows "waking up"). If the account can't use the CloudFront Free plan (e.g. AWS Free Tier accounts), deploy with `make aws-deploy CLOUDFRONT_PLAN=PAY_AS_YOU_GO`.

## Environment variables
| Variable | Default | Description |
|---|---|---|
| `ENV` | `dev` | `prod` refuses to start with the default `SECRET_KEY` |
| `SECRET_KEY` | dev placeholder | JWT signing key. **Required in prod**; on AWS it is generated in Secrets Manager |
| `DATABASE_URL` | `sqlite:///./aliveline.db` | SQLAlchemy URL; `postgres://` URLs are accepted as is. On AWS it is built from the Aurora secret |
| `DB_NULL_POOL` | `false` | `true` on Lambda: no pooled connections, so Aurora can pause |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS (set on AWS) |
| `APP_TZ` | `Europe/Kyiv` | Time zone for day-based planning |
| `OPENAI_API_KEY` | empty | Enables AI estimates and steps (AI Lambda; root `.env` for `make aws-ai`) |
| `OPENAI_MODEL` | `gpt-4.1-mini` | OpenAI model |
| `PADDLE_ENV` | `sandbox` | `sandbox` or `production` |
| `PADDLE_API_KEY` | empty | Paddle API key (AI Lambda only: customer portal) |
| `PADDLE_CLIENT_TOKEN` | empty | Paddle.js token; checkout is shown only when it and the prices are set |
| `PADDLE_WEBHOOK_SECRET` | empty | Verifies the `Paddle-Signature` of webhooks |
| `PADDLE_PRICE_MONTHLY`, `PADDLE_PRICE_YEARLY` | empty | Paddle price IDs for Pro |
| `BILLING_TESTERS` | empty | Comma-separated emails that see checkout while `PADDLE_ENV` isn't `production` |
| `PORT` | `8000` | Port of the all-in-one container |

## Team
Artem Serhiichuk · Ostap Sukhomlyn · Andrii Antoniuk. OOAD course, Ukrainian Catholic University.
