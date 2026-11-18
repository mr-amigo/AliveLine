# AliveLine — OOAD plan

Team: Artem Serhiichuk, Ostap Sukhomlyn, Andrii Antoniuk.
Grading targets (must be hit first): **(A)** repo has `backend/`, `frontend/`, `infra/`, `README.md` explaining product + run + deploy (3 pts);
**(B)** deployed over HTTPS, users can sign up and sign in (3 pts). Phases 1–3 secure both; later phases add the product value.

---

## 1. Problem & vision
Students see a deadline but not how long the work takes → they start the night before.
Moodle / Google Calendar / Todoist show the **due date**. AliveLine shows the **start date**:
AI estimates hours from the assignment description, then a planner counts back from all deadlines
using the student's daily capacity and tells them which tasks need attention today.

Success metrics (from one-pager): 20 early-access signups in 7 days; 8 returning students
(second login on a different day); donations ≥ 20 UAH after testing.
→ The product therefore needs: a public landing page with an early-access form, and a `last_login_at`/login log to count returns.

## 2. Actors & use cases
| Actor | Use case |
|---|---|
| Visitor | UC1 Join early-access list (email) · UC2 Sign up |
| Student | UC3 Sign in / sign out · UC4 Add assignment manually · UC5 Import Moodle calendar (.ics) · UC6 Get AI estimate and correct it · UC7 View plan (work windows, statuses, "today" list) · UC8 Edit / delete / mark done · UC9 Set daily capacity & buffer |
| AI service (Claude) | Secondary actor in UC4/UC5/UC6 |
| Moodle API | Future secondary actor (UC5b, stub only in v1) |

Out of scope v1: notifications, mobile app, Moodle API sync (interface only), teams/sharing.

**Main scenario UC7 (core value):** student opens dashboard → system loads open assignments → for each takes effective hours
(user correction or AI) → planner allocates hours backward from each target finish across all assignments within daily capacity →
returns per-assignment window + status + today's allocation → UI groups cards by status, shows "Today: 2h Lab 3, 1h Essay".

## 3. Domain model

```mermaid
classDiagram
  direction LR
  class User {
    id: int
    email: str  «unique, lowercase»
    name: str
    password_hash: str
    daily_capacity_hours: float = 3
    buffer_days: int = 1
    created_at, last_login_at
  }
  class Course { id; user_id; name «unique per user» }
  class Assignment {
    id; user_id; course_id?
    title; description
    deadline: datetime (UTC)
    source: manual|ics|moodle
    external_uid?  «dedupe imports»
    ai_hours?; ai_rationale?; estimate_source: ai|heuristic
    user_hours?
    done: bool
    +effective_hours() float
  }
  class WaitlistEntry { id; email «unique»; created_at }
  class LoginEvent { id; user_id; at }

  class WorkWindow {
    <<value object>>
    start_date: date
    target_finish: date
    status: Status
    unscheduled_hours: float
  }
  class Status { <<enum>> CAN_WAIT; TIME_TO_START; CRITICAL; DONE }
  class Estimate { <<value object>> hours; rationale; source }

  class Estimator { <<interface>> +estimate(title, description, course) Estimate }
  class ClaudeEstimator
  class HeuristicEstimator
  class AssignmentSource { <<interface>> +parse(data) list~AssignmentDraft~ }
  class IcsSource
  class MoodleApiSource { «stub» }
  class WorkWindowPlanner { +plan(items, capacity, buffer_days, today) Plan }
  class Plan { <<value object>> windows: dict~id,WorkWindow~; daily: dict~date,list~(id,hours)~~ }

  User "1" --> "*" Course
  User "1" --> "*" Assignment
  User "1" --> "*" LoginEvent
  Course "1" --> "*" Assignment
  Estimator <|.. ClaudeEstimator
  Estimator <|.. HeuristicEstimator
  ClaudeEstimator ..> HeuristicEstimator : fallback on error
  AssignmentSource <|.. IcsSource
  AssignmentSource <|.. MoodleApiSource
  WorkWindowPlanner ..> WorkWindow
  WorkWindowPlanner ..> Plan
  WorkWindow --> Status
```

Design decisions:
- **Strategy** — `Estimator` (Claude vs heuristic); `get_estimator()` **factory** picks Claude if `ANTHROPIC_API_KEY` set, else heuristic. Claude errors/timeouts fall back to heuristic, so the app never breaks.
- **Adapter** — `AssignmentSource` turns external formats (.ics now, Moodle API later) into `AssignmentDraft` dataclasses.
- **Value objects** — `WorkWindow`, `Estimate`, `Plan` are frozen dataclasses; computed on read → no stale data.
- **Service layer + DTOs** — routers thin, services own transactions, Pydantic schemas at the boundary.
- **Dependency injection** — FastAPI `Depends(get_db)`, `Depends(current_user)`, `Depends(get_estimator)` (overridable in tests).
- No repository layer (YAGNI: SQLAlchemy session is already a unit-of-work); services query directly.
- No Alembic in v1: `Base.metadata.create_all()` on startup. Add Alembic only if schema changes after real users exist.

## 4. Planning algorithm (domain/planner.py)

Input: `items: list[PlanItem(id, deadline: date, hours: float, done: bool)]`, `capacity` h/day, `buffer_days`, `today`.

1. Open items only (`done=False`); done → status `DONE`, no window.
2. `target_finish = max(today, deadline - buffer_days)`; if `deadline < today` → target_finish = deadline (overdue).
3. Sort open items by `target_finish` **descending** (latest first) — backward "as-late-as-possible" scheduling (mirror of EDF, optimal for feasibility).
4. `free[day] = capacity` for every day in `[today, max target_finish]`.
5. For each item: walk days from `target_finish` back to `today`, take `min(free[day], remaining)`, record allocation. Leftover → `unscheduled_hours`.
6. `start_date` = earliest allocated day (or `today` if none/overdue).
7. Status:
   - `CRITICAL` if `unscheduled_hours > 0` (can't fit before deadline) or deadline already passed or `(deadline - today).days <= 1`.
   - `TIME_TO_START` if `start_date <= today + 1 day` (start today or tomorrow).
   - `CAN_WAIT` otherwise.
8. Return `Plan(windows, daily)`; `daily[today]` powers the "Today" panel.

Rounding: hours to 0.5. Capacity validated 0.5–12, buffer 0–7.
Required tests (tests/test_planner.py): single item fits; two overlapping items push the earlier one earlier; insufficient capacity → critical with unscheduled hours; overdue → critical; done → DONE; far deadline → can_wait; boundary for time_to_start.

## 5. Estimation (domain/estimation/)
- `base.py`: `Estimate` dataclass, `Estimator` Protocol.
- `heuristic.py`: keyword base hours (project 10, exam/test prep 6, essay 5, report/lab 4, homework/problem set 3, quiz 1, default 3) + `min(len(words)/150, 4)`; clamp 0.5–40; rationale explains the rule.
- `claude.py`: anthropic SDK, model `claude-haiku-5-5`, timeout 15 s, max_tokens small; prompt: "Estimate focused hours a 1st–2nd year university student needs… return JSON {hours, rationale (≤ 1 sentence)}". Parse + clamp; any exception → heuristic. (Load `claude-api` skill before writing.)
- Estimate runs on create when `user_hours` absent and on `POST /assignments/{id}/estimate`. On .ics import: estimate each new item (sequential, cap 30 per import; rest heuristic).

## 6. Import (domain/importers/)
- `ics.py` using `icalendar`: for each `VEVENT` → `AssignmentDraft(title, description, deadline=DTEND or DTSTART, course=CATEGORIES or None, external_uid=UID)`.
  Clean Moodle titles: strip suffixes `" is due"`, `" closes"`, `" should be completed"`.
  Skip events whose deadline is > 30 days in the past.
- Service upserts by `(user_id, external_uid)`: new → create (+estimate); existing → update deadline/description only (keep user_hours, done).
- Response: `{created, updated, skipped}`.
- `moodle.py`: `MoodleApiSource` raising `NotImplementedError` + docstring on how to plug a token later.
- Test (tests/test_ics.py) with a small inline Moodle-style .ics fixture.

## 7. REST API (all under `/api`)
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | /health | – | `{status:"ok"}` |
| POST | /waitlist | – | `{email}` → 201 (idempotent) |
| POST | /auth/signup | – | `{email, password(≥8), name}` → `UserOut` + cookie |
| POST | /auth/signin | – | `{email, password}` → `UserOut` + cookie (logs LoginEvent) |
| POST | /auth/signout | ✓ | → 204, clears cookie |
| GET | /auth/me | ✓ | → `UserOut` (401 if no/invalid cookie) |
| PATCH | /settings | ✓ | `{name?, daily_capacity_hours?, buffer_days?}` → `UserOut` |
| GET | /plan | ✓ | → `{today, today_items:[{assignment_id,title,hours}], assignments:[AssignmentOut]}` |
| POST | /assignments | ✓ | `{title, description?, course_name?, deadline, user_hours?}` → `AssignmentOut` |
| PATCH | /assignments/{id} | ✓ | partial (incl. `user_hours`, `done`) → `AssignmentOut` |
| DELETE | /assignments/{id} | ✓ | → 204 |
| POST | /assignments/{id}/estimate | ✓ | → `AssignmentOut` (re-run AI) |
| POST | /import/ics | ✓ | multipart `file` (≤ 1 MB) → `{created, updated, skipped}` |

`AssignmentOut = {id, title, description, course_name, deadline, source, ai_hours, ai_rationale, estimate_source, user_hours, effective_hours, done, window:{start_date, target_finish, status, unscheduled_hours} | null}`.
Every mutation endpoint returns windows recomputed for the whole plan (simplest: frontend refetches `/plan` after mutations).
Ownership: every assignment query filters by `user_id`; foreign id → 404.

Security: bcrypt (cost 12); JWT HS256, 7-day exp, claim `sub=user_id`; cookie httpOnly, SameSite=Lax, `Secure` when `COOKIE_SECURE=true`; generic "Invalid email or password"; email normalized lowercase; `SECRET_KEY` required when `ENV=prod`.

## 8. Frontend
Routes:
| Path | Page | Notes |
|---|---|---|
| `/` | Landing | hero "Know when to start, not just when it's due", 3-step explainer, early-access form, CTA sign up. Redirect to /app if signed in |
| `/signup`, `/signin` | Auth forms | inline validation, show API `detail` |
| `/app` | Dashboard | "Today" panel (allocations), columns/sections Critical → Time to start → Can wait, Done collapsed; empty state with "Add" + "Import .ics" |
| `/app/new`, `/app/a/:id` | Assignment form | title, course, deadline (datetime-local), description, AI estimate shown with rationale + editable hours, "Re-estimate", delete, mark done |
| `/app/import` | Import | file input + instructions how to export Moodle calendar (.ics), result summary |
| `/app/settings` | Settings | name, daily capacity slider, buffer days |

Structure: `api/client.ts` (fetch wrapper, `credentials:'include'`, throws `ApiError(detail)`), `api/types.ts` (mirrors §7),
`auth/AuthContext.tsx` (user, signin, signup, signout, loading; calls `/auth/me` on boot), `auth/RequireAuth.tsx`,
`components/` (Layout+Navbar, StatusBadge, AssignmentCard, TodayPanel, HoursInput, Button/Input/Field), `pages/` one file per route.
Dates: `Intl.DateTimeFormat('en-GB')` + relative "in 3 days". Data refetch after each mutation (no state lib).

Design tokens (keep consistent):
- Mood: calm, focused, student-friendly; lots of white space; one accent.
- Colors: bg `#FAFAF7`, text `#1C1C1E`, accent (brand "alive" green) `#16A34A`; statuses: can_wait slate `#64748B`, time_to_start amber `#D97706`, critical red `#DC2626`, done green muted.
- Font: Inter (Google Fonts) fallback system-ui; radius 12px cards; subtle shadow; mobile-first, responsive.
- Brand: logo text "Alive" + pulse-line icon (inline SVG) + "Line".

## 9. Infra & deployment
- `infra/Dockerfile` (context = repo root): stage 1 `node:22-slim` (Alpine breaks Rollup) → `npm ci && npm run build` in frontend; stage 2 `python:3.12-slim` → install backend reqs, copy `backend/app`, copy `frontend/dist` → `/app/static`; `CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
- `main.py`: if `static/` exists, mount `/assets` and return `index.html` for any non-`/api` GET (SPA fallback).
- `infra/render.yaml` (Blueprint): web service, `runtime: docker`, `dockerfilePath: ./infra/Dockerfile`, `dockerContext: .`, `healthCheckPath: /api/health`, plan free, env: `ENV=prod`, `COOKIE_SECURE=true`, `SECRET_KEY` (generateValue), `DATABASE_URL` (sync:false), `ANTHROPIC_API_KEY` (sync:false).
- `infra/docker-compose.yml`: app + postgres:16 for full local prod-like run.
- DB: Neon free Postgres; URL form `postgresql+psycopg://…?sslmode=require` (config converts `postgres://` prefix automatically).
- `.env.example` in backend/.
- Deploy steps (README): 1) Neon → create DB, copy URL. 2) Render → New → Blueprint → this repo → set `DATABASE_URL`, `ANTHROPIC_API_KEY`. 3) Open `https://<service>.onrender.com`, sign up. Note: free tier sleeps after 15 min idle (first request ~50 s).
- CI (optional, phase 8): GitHub Action running `pytest` + `npm run build`.

## 10. README outline (phase 3, refined in 8)
What it is (2 lines + screenshot) · Why (problem vs Moodle/Calendar) · Features · Architecture (diagram link to this file) · Repo layout · Run locally · Run with Docker · Deploy (Render + Neon) · Env vars table · Team.

---

## Phases
Each phase ≈ one session. Tick boxes as you go. Keep scope tight.

### Phase 1 — Backend core + auth  (secures B, part 1)
- [x] `backend/requirements.txt`, `.env.example`, `app/core/{config,db,security,deps}.py`
- [x] models: User, LoginEvent, WaitlistEntry (Course/Assignment added in phase 4)
- [x] schemas/auth.py; services/auth_service.py; api/{health,auth,settings,waitlist}.py; main.py (create_all, routers, SPA fallback)
- [x] tests/conftest.py (SQLite in-memory, TestClient) + tests/test_auth.py (signup, duplicate, signin bad/good, me, signout)
- [x] check root .gitignore covers `.venv`, `node_modules`, `dist`, `*.db`, `.env`
- DoD: `pytest -q` green; manual curl signup/me works.

### Phase 2 — Frontend shell + auth pages  (secures B, part 2)
- [x] Vite React TS scaffold (write files directly, don't run interactive create), Tailwind v4, router, proxy
- [x] api/client.ts, api/types.ts, AuthContext, RequireAuth, Layout/Navbar, basic UI primitives
- [x] pages: Landing (simple version + waitlist form), SignUp, SignIn, Dashboard placeholder, Settings
- DoD: `npm run build` ok; locally sign up → land on /app → refresh keeps session → sign out.

### Phase 3 — Infra + deploy + README  (secures A & B)
- [x] infra/Dockerfile, infra/render.yaml, infra/docker-compose.yml
- [x] `docker build` + run locally → sign up works on :8000
- [x] README.md per §10 (first version)
- [ ] User creates Neon + Render, deploys; verify HTTPS sign up/sign in on live URL; put URL in README
- DoD: live HTTPS URL, sign up/in works. Commit + push.

### Phase 4 — Assignments + planner (core domain)
- [ ] models Course, Assignment; domain/planner.py; tests/test_planner.py (cases in §4)
- [ ] services/assignment_service.py, services/plan_service.py; api/assignments.py, GET /plan
- [ ] tests/test_assignments.py (CRUD, ownership 404, plan statuses)
- DoD: tests green.

### Phase 5 — AI estimation
- [ ] load `claude-api` skill; domain/estimation/{base,heuristic,claude}.py; factory in deps
- [ ] wire into create + `/estimate`; tests with heuristic + fake estimator override
- DoD: with key → real estimate + rationale; without key → heuristic; failures fall back.

### Phase 6 — .ics import
- [ ] domain/importers/{base,ics,moodle}.py; services/import_service.py; api/imports.py
- [ ] tests/test_ics.py (parse, title cleanup, upsert)
- DoD: real Moodle export imports with estimates.

### Phase 7 — Product UI
- [ ] load `frontend-design` skill once; apply §8 tokens
- [ ] Dashboard (TodayPanel, status sections, AssignmentCard), AssignmentForm (estimate + correction), Import page, polished Landing
- [ ] responsive check, empty/loading/error states
- DoD: full flow on live site: sign up → import .ics → see start dates → correct hours → statuses update.

### Phase 8 — Finish
- [ ] README final (screenshot, live URL, env table), optional GitHub Action CI
- [ ] stats query snippet for metrics (waitlist count, returning users = users with LoginEvents on ≥ 2 distinct days)
- [ ] final deploy + smoke test

## Progress log
- 2026-11-18 — Phase 0: plan written (CLAUDE.md, docs/PLAN.md, docs/ONE_PAGER.md).
- 2026-11-18 — Phase 1 done: FastAPI core, cookie-JWT auth, settings, waitlist, LoginEvent; 8 tests green. Added `schemas/common.UtcDatetime` (SQLite drops tz) — use it for all datetime outputs.
- 2026-11-18 — Phase 2 done: Vite/React/TS/Tailwind v4 shell; AuthContext, RequireAuth, Landing (+waitlist, preview card), SignIn/SignUp (shared AuthForm), Settings, Dashboard placeholder; ui.tsx primitives (Button, Field, Input, Alert, Card, Spinner). Build ok; SPA fallback verified via backend/static.
- 2026-11-18 — Phase 3 (code) done: infra/{Dockerfile,render.yaml,docker-compose.yml}, .dockerignore, README. Image + compose (Postgres) smoke-tested: health, signup, me, SPA. Blueprint Path must be set to `infra/render.yaml`. Remaining: user deploys Neon + Render, then tick last box + add URL.
