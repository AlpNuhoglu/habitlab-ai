# HabitLab AI — Context for Claude Code

**Read this file before making any non-trivial change to the codebase.** This file is your project brief. The full specification is in `docs/HabitLab_AI_Analysis_Report.docx` — consult it whenever a design question comes up that this file does not answer.

---

## What this project is

HabitLab AI is a personal portfolio project by Alp Nuhoğlu (Computer Engineering, Sabancı University). It is a habit-tracking application whose differentiator is an **event-driven architecture** with **behavioral analytics**, **AI-augmented recommendations**, and a **controlled A/B testing framework**. It is deliberately not a typical CRUD habit tracker; the engineering pattern is the point of the project.

The project is developed part-time by a single person. Keep scope discipline: anything that feels like "nice to have" is almost certainly not in the MVP.

---

## Architectural non-negotiables

These decisions are finalized. Do not propose alternatives without explicit prompting.

1. **Stack**: React 18 + Vite + TypeScript (frontend), NestJS 10 + TypeScript (backend + worker), PostgreSQL 16, Redis 7. LLM provider is OpenAI (gpt-4o-mini default) behind an abstract `LLMProvider` interface.
2. **Event-driven write path**: every user action that changes state emits a domain event to the `events` table, in the **same DB transaction** as the state change. Outbox pattern; no exceptions.
3. **Idempotent consumers**: workers use the `processed_events(event_id, consumer_name)` table to dedupe at-least-once deliveries.
4. **CQRS-lite reads**: dashboard and analytics reads served from Redis. Workers `DEL` cache keys on state changes; they do not `SET`. The next read rebuilds.
5. **A/B testing**: deterministic variant assignment via `SHA-256(user_id || ":" || experiment_key) mod sum(weights)`. Assignments persisted immutably. Analysis uses `experiment.exposure` events, not assignments.
6. **Security**: JWT in httpOnly + SameSite=Strict cookies (client never reads tokens). bcrypt cost 12. Every repository method filters by `user_id`. No row leaves without that filter applied. `UserScopedRepository<T>` base class enforces this.
7. **No browser storage for auth**: never `localStorage`/`sessionStorage` for tokens. Cookies only.
8. **OpenAPI-first frontend types**: backend generates spec via `@nestjs/swagger`; frontend types are generated from the spec. CI drift check blocks PRs on mismatch.

---

## Repository layout

```
habitlab-ai/
├── backend/               NestJS app (HTTP tier + worker tier)
│   └── src/
│       ├── modules/       one subdir per bounded context (auth, habits, events, analytics, experiments, recommendations, notifications)
│       ├── infrastructure/  database, cache, broker, llm — the adapters
│       ├── common/        shared guards, interceptors, decorators, base classes (UserScopedRepository, etc.)
│       └── main.ts        bootstrap
├── frontend/              React SPA
│   └── src/
│       ├── pages/         one file per top-level route (Dashboard, Habits, Analytics, Settings)
│       ├── components/    reusable UI pieces
│       ├── api/           typed client (generated types + fetch wrapper)
│       ├── hooks/         React Query hooks, Zustand stores
│       └── main.tsx       bootstrap
├── worker/                placeholder — workers run in backend process for MVP, split later
├── shared/                TypeScript types shared between frontend and backend
├── docs/                  the analysis report lives here
├── docker/                local-dev infra (postgres init scripts, etc.)
├── .github/workflows/     CI pipeline
└── CLAUDE.md              this file
```

---

## How to answer questions about the domain

Before answering:

1. If the question is about the **data model**, open `docs/HabitLab_AI_Analysis_Report.docx` section 5. Do not invent columns; every field is specified there.
2. If the question is about an **API endpoint**, consult section 6.1.
3. If the question is about an **event type or payload**, consult section 6.2.
4. If the question is about the **LLM integration or safety filter**, consult section 6.3.
5. If the question is about an **A/B test assignment**, consult section 6.5.
6. If the question is about a **user-level flow**, consult section 7.2 (use cases) and 7.4 (sequence diagrams).

If a decision is not specified in the doc, say so and propose an option rather than silently guessing.

---

## Work package status

Track which WP is active. Check the box when a WP is done and the project ships a working increment.

- [x] **WP1** — Repo scaffolding, docker-compose, CI pipeline green on empty test.
- [x] **WP2** — Auth: register, verify, login, refresh, logout, password reset.
- [x] **WP3** — Habit CRUD + daily tracking + basic dashboard (synchronous aggregation).
- [ ] **WP4** — Event log with partitioning, outbox publisher, broker abstraction.
- [ ] **WP5** — Analytics worker, `user_analytics` + `habit_analytics` tables, Redis cache.
- [ ] **WP6** — Rule-based recommendation engine.
- [ ] **WP7** — LLM augmentation with safety filter + cost controls.
- [ ] **WP8** — A/B testing subsystem (assignment, exposure logging, analysis SQL).
- [ ] **WP9** — Web push notifications with variant-aware copy.
- [ ] **WP10** — Observability + production deployment.

---

## Conventions

- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **Branches**: trunk-based. Short-lived branches off `main`, merged via PR after CI passes. No long-lived release branches.
- **PRs**: title references the WP and a FR/NFR number where applicable. Every PR updates tests that lock in the new behavior.
- **File names**: kebab-case. Class names: PascalCase. Functions/variables: camelCase. Database: snake_case, plural table names.
- **No comments that restate the code.** Comments explain *why*, not *what*.
- **Never suppress TypeScript errors with `@ts-ignore` or `any`.** Use `unknown` and narrow, or fix the type.
- **No secrets in the repo.** Secrets come from env vars loaded via `@nestjs/config`.

---

## When you are asked to do something

If the task is large (>5 file changes or introduces a new bounded context), **use plan mode** — propose a plan, wait for approval, then execute. Do not one-shot architectural changes.

If you need a decision I have not specified, ask. Do not guess and then apologize later.

Before touching the database schema, check the analysis report section 5.1 — the table or column may already be specified there.

---

## WP3 implementation notes

- **Weekly/custom habit streak**: WP3 uses the same day-level streak algorithm as daily habits (`computeCurrentStreak` in `habits.service.ts`). The spec says "consecutive satisfied weeks" for weekly/custom — this must be revised in **WP5** when the analytics worker is built. Ticket: rewrite `computeCurrentStreak` to accept `frequencyType` and compute week-level satisfied-weeks for non-daily habits.
- **Dashboard performance**: WP3 hits Postgres directly on every `GET /dashboard` (no cache). `X-Cache: MISS` always. Redis warm path comes in WP5 via the analytics worker.
- **Streak denominator (completionRate30d)**: always 30, regardless of habit age. Consistent UX; agreed in plan review.
