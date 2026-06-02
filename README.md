# Task Tracking Dashboard — Backend + Web Vertical Slice

A runnable end-to-end slice of the v2.0 spec: a **FastAPI** backend (async SQLAlchemy / PostgreSQL)
and a **Next.js** web client, covering **auth, the task board, and the create → approve flow**.

```
project_2/
├── backend/         # FastAPI REST API
├── web/             # Next.js App Router web client
└── README.md
```

## What's in this slice

**Backend**
- JWT auth (access + refresh), bcrypt hashing, RBAC guards (`Assigner` / `Assignee`)
- Tasks: list (filter/sort/paginate), detail, create, soft-delete, status transitions
- Server-enforced status pipeline + blocked-task `422`
- Dependencies: add (with **cycle detection**), remove, **auto-unblock** cascade on approval
- Approvals: approve / request-changes with history
- Progress updates, notifications (personal feed + mark read), metrics endpoints
- Seed data (Curl'o Hair team: 8 users, 140 assigned tasks), pytest suite

**Web**
- Login (seeded credentials), token storage + axios refresh interceptor
- Sidebar shell, user context, role-aware nav
- Dashboard (status donut + workload bar + metric cards)
- My Tasks / All Tasks with **Kanban** and **List** views
- Task detail panel (slides in), create modal, approval modal w/ follow-up prompt
- Queue/dependency view, activity feed

## Deferred to the next milestone (need running infra; intentionally not stubbed)
- React Native mobile app
- Celery workers, email (SendGrid), push (FCM)
- WebSocket real-time channel + Redis pub/sub
- S3/MinIO file attachments
- Nginx, full CI/CD, Sentry/Prometheus

## Run it

**One command (Windows / PowerShell):**

```powershell
# first-time setup
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
cd web; npm install; cd ..

# start everything (backend + web) — frees stale ports, hot-reloads both tiers
.\dev.ps1        # web → http://localhost:3000 ,  API → http://localhost:8000
.\stop-dev.ps1   # stop both
```

`dev.ps1` creates `backend/.env` (SQLite) and `web/.env.local` on first run, kills any stale
listeners on :8000/:3000, then opens the backend (`uvicorn --reload`) and web (`next dev -p 3000`)
each in their own window. The backend auto-reloads on code changes; the web app has HMR.

**Manual / cross-platform:**

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate        # or: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then set DATABASE_URL=sqlite+aiosqlite:///./dev.db for a local run
uvicorn app.main:app --reload                          # auto-creates tables + seeds on first boot

# Web
cd web && npm install && cp .env.local.example .env.local && npm run dev
```

Seeded logins (password for all: `password123`) — the Curl'o Hair team:
Assigners (create/approve): `ritik@curlohair.com` (Founder), `tanishk@curlohair.com` (Senior Manager), `prakash@curlohair.com` (Consultant).
Assignees (do the work): `anmol@curlohair.com`, `pushpendra@curlohair.com`, `kunal@curlohair.com`, `saksham@curlohair.com`, `suraj@curlohair.com`.

API docs: http://localhost:8000/docs

## Verification status

Verified locally against SQLite:

- **Backend:** `cd backend && .venv\Scripts\python -m pytest` → **11 passing** (auth + refresh
  rotation, RBAC incl. self-assign rules, full task lifecycle, blocked-start `422`, dependency
  cycle detection + auto-unblock). Tests run against in-memory SQLite — no Postgres needed.
- **Web:** `npm run build` → compiles, type-checks, and prerenders all routes.
- End-to-end: login → create → start → progress update → submit → approve, plus the per-user
  Chat→Task module, exercised against the running API.

## Deviations from the v2.0 spec (intentional, for this slice)

- **UI library:** hand-rolled Tailwind components instead of `shadcn/ui` (its CLI copies
  files into the repo; not runnable to generate here). Swap-in is straightforward later.
- **Forms:** plain controlled inputs instead of React Hook Form + Zod — no `<form>` usage,
  validation done inline. RHF/Zod can be layered without changing the API contract.
- **Kanban DnD:** status changes happen via context-sensitive buttons in the detail panel
  rather than `@dnd-kit` drag-and-drop. The transition API is identical; DnD is a UI add-on.
- **Migrations:** the API uses `Base.metadata.create_all` on startup for a one-command dev
  boot. Alembic is scaffolded (`backend/alembic/`) and ready — run
  `alembic revision --autogenerate -m "init"` then `alembic upgrade head` to switch over.
- Progress-update editing window, audit log, and full-text `tsvector` search are modeled in
  the spec but not part of this slice's endpoints (basic `q=` substring filter is wired).
