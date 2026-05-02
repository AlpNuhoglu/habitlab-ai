# HabitLab AI

An AI-driven behavior-optimization platform. Personal portfolio project by Alp Nuhoğlu.

> HabitLab AI treats habit tracking as a behavior-optimization problem, not a checklist. Every user action is a typed domain event; a worker tier maintains real-time analytics; a rule engine augmented by an LLM generates personalized recommendations; all of it is delivered under an A/B testing framework that measures lift against a control.

**Full specification**: [`docs/HabitLab_AI_Analysis_Report.docx`](./docs/HabitLab_AI_Analysis_Report.docx) (95 pages — data model, API spec, event catalog, LLM prompt template, A/B methodology).

---

## Quick start

### Prerequisites

- **Node.js ≥ 20** (`node --version`)
- **pnpm ≥ 9** (`npm install -g pnpm`)
- **Docker Desktop** running (for Postgres + Redis)
- **Git**

### First-time setup

```bash
# 1. Clone and install deps
git clone <repo-url> habitlab-ai
cd habitlab-ai
pnpm install

# 2. Bring up Postgres + Redis
pnpm db:up

# 3. Copy the env template and fill in local-dev values
cp .env.example .env
# Edit .env — at minimum: DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 4. Apply DB migrations
pnpm --filter backend migrate

# 5. Start the dev servers (backend + frontend)
pnpm dev
```

| URL | What you see |
|-----|-------------|
| http://localhost:3001/health | `{"status":"ok"}` — liveness probe |
| http://localhost:3001/ready | `{"status":"ok","checks":{...}}` — readiness probe (Postgres + Redis) |
| http://localhost:3001/metrics | Prometheus metrics endpoint |
| http://localhost:3001/api/docs | Swagger UI — interactive API explorer |
| http://localhost:5173 | React frontend SPA |

---

## Running tests

```bash
# Unit tests (fast, no DB required)
pnpm --filter backend test

# Integration / e2e tests (requires pnpm db:up first)
pnpm --filter backend test:e2e

# E2e with coverage report
pnpm --filter backend test:e2e --coverage
```

---

## Architecture at a glance

```
  Client (React SPA)
       │ HTTPS + JWT httpOnly cookie
       ▼
  API (NestJS) ──────────────────────────────────────► Postgres
       │ outbox pattern (same TX as state change)       (source of truth)
       ▼
  Broker (Redis Streams)
       ├─► Analytics worker  ──► user_analytics / habit_analytics ──► DEL Redis cache
       ├─► Recommendation worker ──► rule engine + LLM augmentation ──► recommendations table
       └─► (Outbox publisher polls & publishes)

  Notification scheduler (60s cron) ──► Web Push API
  A/B testing (SHA-256 deterministic) ──► experiment_assignments
```

See section 3 of the analysis report for the full picture.

---

## Work package status

| WP | Description | Status |
|----|-------------|--------|
| WP1 | Repo scaffolding, docker-compose, CI | ✅ Done |
| WP2 | Auth: register, verify, login, refresh, logout, password reset | ✅ Done |
| WP3 | Habit CRUD + daily tracking + basic dashboard | ✅ Done |
| WP4 | Event log with partitioning, outbox publisher, broker abstraction | ✅ Done |
| WP5 | Analytics worker, `user_analytics` + `habit_analytics`, Redis cache | ✅ Done |
| WP6 | Rule-based recommendation engine (6 rules) | ✅ Done |
| WP7 | LLM augmentation with safety filter + cost controls | ✅ Done |
| WP8 | A/B testing subsystem (assignment, exposure logging, analysis SQL) | ✅ Done |
| WP9 | Web push notifications with variant-aware copy | ✅ Done |
| WP10 | Observability + production readiness | ✅ Done |

---

## Observability (WP10)

- **Structured logging**: pino JSON logger on every request — `request_id`, `user_id`, `route`, `method`, `status`, `duration_ms`. Sensitive fields auto-redacted.
- **Prometheus metrics**: `GET /metrics` — RED metrics + 4 business KPIs (`habitlab_events_published_total`, `habitlab_recommendations_generated_total{source}`, `habitlab_notifications_sent_total`, `habitlab_llm_cost_cents_total`).
- **Health probes**: `GET /health` (liveness) · `GET /ready` (readiness — Postgres + Redis ping, 503 on failure).
- **Audit log**: `audit_log` table — records `user.password_changed` and `recommendation.accepted` events.
- **Graceful shutdown**: `SIGTERM` → in-flight requests drain → all workers stop cleanly.

See [`backend/RUNBOOK.md`](./backend/RUNBOOK.md) for operational procedures.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). In short: one-week sprints, Conventional Commits, trunk-based, CI green before merge.

### Updating the OpenAPI spec

When you change an API endpoint or DTO, regenerate `backend/openapi.json`:

```bash
pnpm db:up
pnpm --filter backend generate:openapi
git add backend/openapi.json
```

CI will fail if the committed spec drifts from the generated one.

## Using Claude Code on this repo

[`CLAUDE.md`](./CLAUDE.md) is the context file Claude Code reads automatically every session. It pins the architectural non-negotiables and tells Claude where to find the full spec.

## License

TBD. This is a personal portfolio project; the code will likely be made public under MIT once a stable v1 ships.
