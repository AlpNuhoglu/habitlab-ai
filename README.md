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
# (edit .env — for Phase 1 only DATABASE_URL, REDIS_URL, and the two JWT_* secrets matter)

# 4. Apply DB migrations (once WP2 lands, not needed before that)
# pnpm migrate

# 5. Start the dev servers (backend + frontend)
pnpm dev
```

Backend: http://localhost:3001  ·  Frontend: http://localhost:5173  ·  API docs: http://localhost:3001/api/docs

---

## Architecture at a glance

```
  Client (React SPA)
       │ HTTPS + JWT cookie
       ▼
  API (NestJS) ───► Postgres (source of truth, append-only events table)
       │ emits
       ▼
  Broker (Redis Streams local / Pub/Sub prod)
       │
       ▼
  Worker tier ───► updates analytics ───► DEL Redis cache ───► calls LLM for recommendations
```

See section 3 of the analysis report for the full picture.

---

## Project status

This is a work-in-progress. The project ships in three phases:

| Phase | Weeks | Work packages | Demo-able increment |
|-------|-------|---------------|---------------------|
| **1 Foundation** | 1–4  | WP1–WP3 | Working habit tracker with auth (CRUD only) |
| **2 Event-driven** | 5–9  | WP4–WP6 | Event log, worker-maintained analytics, rule-based recs |
| **3 Intelligence** | 10–15 | WP7–WP10 | LLM augmentation, A/B tests, notifications, prod deploy |

Current phase: **Phase 2, WP5**.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). In short: one-week sprints, Conventional Commits, trunk-based, CI green before merge.

## Using Claude Code on this repo

[`CLAUDE.md`](./CLAUDE.md) is the context file Claude Code reads automatically every session. It pins the architectural non-negotiables and tells Claude where to find the full spec. If you open the repo in VS Code with the Claude Code extension installed, start any session by confirming that Claude has read `CLAUDE.md` — if not, @-mention it.

## License

TBD. This is a personal portfolio project; the code will likely be made public under MIT once a stable v1 ships.
