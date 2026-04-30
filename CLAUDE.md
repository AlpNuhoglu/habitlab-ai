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
- [x] **WP4** — Event log with partitioning, outbox publisher, broker abstraction.
- [x] **WP5** — Analytics worker, `user_analytics` + `habit_analytics` tables, Redis cache.
- [x] **WP6** — Rule-based recommendation engine.
- [x] **WP7** — LLM augmentation with safety filter + cost controls.
- [x] **WP8** — A/B testing subsystem (assignment, exposure logging, analysis SQL).
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

- **Weekly/custom habit streak**: WP3 uses the same day-level streak algorithm as daily habits (`computeCurrentStreak` in `habits.service.ts`). The spec says "consecutive satisfied weeks" for weekly/custom — this must be revised in **WP6** when the recommendation engine is built. Ticket: rewrite `computeCurrentStreak` to accept `frequencyType` and compute week-level satisfied-weeks for non-daily habits.
- **Dashboard performance**: WP3 hits Postgres directly on every `GET /dashboard` (no cache). `X-Cache: MISS` always. Redis warm path comes in WP5 via the analytics worker. ✅ **Resolved in WP5.**
- **Streak denominator (completionRate30d)**: always 30, regardless of habit age. Consistent UX; agreed in plan review.

---

## WP5 implementation notes

- **CacheService**: `CACHE_SERVICE` token exported from `InfrastructureModule` (global). `RedisCacheAdapter` in prod/dev, `NullCacheAdapter` (get→null, set/del→no-op) in `NODE_ENV=test` or `BROKER_ADAPTER=stub`. Tests always get cache MISS — no Redis required.
- **Cache key constants**: `CacheKeys` in `infrastructure/cache/cache-keys.ts`. Keys: `dashboard:{userId}` TTL 300s, `analytics:{userId}:global` TTL 600s, `analytics:{userId}:habit:{habitId}` TTL 600s (§6.4.1).
- **Cache coherence**: read-through + explicit DEL (§6.4.2). Worker DELs after DB commit; API SETs on cache miss. No write-through.
- **Analytics worker**: `AnalyticsWorkerService` — in non-test mode polls Redis Stream `habitlab:events` via XREADGROUP (consumer group `habitlab-analytics`). In test mode, polling is skipped; `handleEvent(event)` is called directly by integration tests. Idempotency via `processed_events(event_id, 'analytics-worker')` INSERT ON CONFLICT DO NOTHING (§6.2.4).
- **completion_by_hour source**: `EXTRACT(HOUR FROM habit_logs.logged_at AT TIME ZONE users.timezone)` — actual log time, not preferred_time. Gives real behavioral insight ("you actually complete this at 18:00").
- **completion_by_weekday**: `MOD(EXTRACT(DOW FROM logged_at AT TIME ZONE tz)::int + 6, 7)` — Mon=0..Sun=6 (matches §5.1.8 best_weekday convention).
- **Weekly/custom streak in analytics worker**: `recomputeHabitAnalytics` uses day-level `computeCurrentStreak` / `computeLongestStreak` (WP3 carry-over). TODO comment in `analytics-worker.service.ts`. Fix in WP6 alongside recommendation engine.
- **monthly_trend (FR-041)**: not stored in `habit_analytics` DDL — computed on demand per endpoint call and cached with the rest of the analytics response.
- **completion_rate_all_time (FR-041)**: not stored in `habit_analytics` DDL — computed on demand: `completed_count / days_since_habit_created`.
- **Migration**: `1745300000000-AnalyticsSchema.ts`. DDL is §5.1.8 + §5.1.9 verbatim. `down()` is empty (forward-only).
- **Analytics endpoints**: `GET /habits/:id/analytics` (FR-041), `GET /habits/:id/calendar?from&to` (FR-042, max 365 days, no cache), `GET /analytics` (FR-043). All in `AnalyticsModule`.

---

## WP6 implementation notes

- **RecommendationWorkerService**: consumer group `habitlab-recommendations` on stream `habitlab:events`. Same XREADGROUP pattern as analytics worker. Idempotency via `processed_events(event_id, 'recommendations-worker')`. Skips evaluation if `habit_analytics` row absent (logs WARN).
- **6 rules** (all in `modules/recommendations/rules/`): `reschedule` (best_hour vs preferred_time ≥2h diff, priority 70), `reduce_difficulty` (rate30d<0.4 && difficulty≥3, priority 80), `streak_celebration` (streak%7===0, priority 60), `encouragement_after_skip` (2+ skips in 3 days, priority 75), `consistency_reinforcement` (rate30d>0.8 && streak>14, priority 65), `retroactive_logging_reminder` (no logs in 3 days, priority 85).
- **Cooldown (FR-053)**: `hasCooldownActive(userId, habitId, category)` — checks `recommendations` table for same `(user_id, habit_id, category)` in last 14 days. Applies on both new generation and after dismiss (dismiss reuses the same record's `created_at`).
- **accept action_payload**: `reschedule` category sets `action_payload: { preferred_time: "HH:00" }`. `accept()` applies it atomically: `UPDATE habits SET preferred_time = $1`.
- **Dashboard**: `GET /dashboard` queries `recommendations WHERE status='active' ORDER BY priority DESC LIMIT 3` directly (no cache, no circular import — raw SQL via `DataSource`).
- **Migration**: `1745400000000-RecommendationsSchema.ts`. ENUMs + table DDL verbatim §5.1.11. `down()` empty (forward-only).
- **LLM columns** (`llm_model`, `llm_tokens_input`, etc.): present in entity/table, always NULL in WP6. WP7 populates them.
- **experiment_variant**: NULL in WP6; WP8 writes variant at recommendation creation time.

---

## WP7 implementation notes

- **LLMProvider interface**: `complete(prompt): Promise<LLMResponse | null>`. `LLMResponse` carries `{ text, model, tokensInput, tokensOutput, costCents }`. Null return = provider unavailable → caller uses template fallback.
- **NullLlmProvider**: always returns null. Active when `NODE_ENV=test` OR `OPENAI_API_KEY` is absent (same `shouldUseStub()` gate as broker/cache).
- **OpenAILlmProvider**: `gpt-4o-mini` (override via `OPENAI_MODEL`), temp=0.3, max_tokens=150, timeout=8000ms, 1 retry on 429/5xx with 2s backoff. Retry handled manually (not via SDK) for circuit-breaker awareness.
- **Cost constants** (gpt-4o-mini): input 0.015 cent/1K tokens, output 0.060 cent/1K tokens. `OPENAI_DAILY_BUDGET_CENTS` env (default 300 = $3).
- **LLM gate order** (§6.3.1, any fail → template): (1) `ai_recommendations_enabled`, (2) circuit breaker, (3) per-user daily quota ≥ 3, (4) system budget.
- **Per-user quota**: DB-based `COUNT(*) WHERE source='ai' AND created_at > now() - interval '1 day'`. Max 3. Testable without Redis.
- **System budget**: Redis `INCRBYFLOAT llm:cost:cents:{YYYY-MM-DD}`. Redis null (test) → check skipped.
- **Circuit breaker**: `llm:circuit:errors` INCR + 60s EXPIRE on each error; ≥5 → SET `llm:circuit:open` EX 300. Success → DEL error counter. Redis null → both checks skipped.
- **Safety filter** (`applySafetyFilter`, pure fn, §6.3.3): (1) >280 chars → truncate at last sentence boundary or null, (2) medical keywords → null, (3) structural refusal / ends with `?` / contains URL → null.
- **Prompt builder** (`buildLlmPrompt`, pure fn, §6.3.2): derives bestWeekday/worstWeekday from `completionByWeekday` array, bestHour from `completionByHour` array; all-zeros → "no clear pattern". Locale-aware weekday names: `en`/`tr`.
- **InsertData** extended: optional `source`, `llmModel`, `llmTokensInput`, `llmTokensOutput`, `llmCostCents` (all `T | undefined` for `exactOptionalPropertyTypes` compliance).
- **No migration**: LLM columns (`llm_model`, `llm_tokens_input`, `llm_tokens_output`, `llm_cost_cents`) already present in WP6 table DDL — always NULL until WP7 worker populates them.

---

## WP8 implementation notes

- **Migration**: `1745500000000-ExperimentsSchema.ts`. Creates `experiment_status` ENUM + `experiments` + `experiment_assignments` tables verbatim §5.1.10. `down()` empty (forward-only).
- **ExperimentRepository**: plain `@Injectable()`, NOT `UserScopedRepository` — `experiments` table has no `user_id`. All methods global. Exports `AssignmentService` and itself from `ExperimentsModule`.
- **AssignmentService.getOrAssign(userId, experimentKey)**: lazy assignment — looks up experiment, checks opt-out, checks existing assignment, then SHA-256 hash if new. Returns `'control'` (no DB write) when experiment not found / not running / user opted out.
- **AssignmentService.getOrAssignIfActive(userId, experimentKey)**: returns `null` (not `'control'`) when experiment not running — used by recommendation worker so `experiment_variant` stays NULL on inactive experiments.
- **SHA-256 algorithm** (§6.5.1): `createHash('sha256').update('${userId}:${experimentKey}').digest()` → `readBigUInt64BE(0)` → `% BigInt(sum(weights))` → walk variants with cumulative sum.
- **Exposure event**: `GET /experiments/variant` emits fire-and-forget `experiment.exposure` events per key via plain `dataSource.query()` (not in a transaction). Payload: `{ experimentKey, variantKey }`.
- **Opt-out**: `PATCH /me/preferences { experiments_opted_out: true }` (WP2 endpoint). No new assignments written; opted-out users always get `variants[0].key` (control).
- **Rec worker integration**: `AssignmentService.getOrAssignIfActive(userId, 'rec_copy_v1')` called BEFORE the outer `dataSource.transaction()` (avoids nested transactions). Result stored in `experimentVariant` field of every recommendation INSERT.
- **InsertData** extended: optional `experimentVariant?: string | null | undefined`.
- **CLI**: `pnpm cli <command> [options]` via `ts-node -r tsconfig-paths/register src/cli/cli.ts`. Commands: `experiment:create --file`, `experiment:start --key`, `experiment:pause --key`, `experiment:analyze --key`. No new npm dependencies.
- **Analysis z-test**: computed in TypeScript from SQL-returned `(n, retained_n)` pairs. `p_pool = (r1+r2)/(n1+n2)`, `z = diff / sqrt(p_pool*(1-p_pool)*(1/n1+1/n2))`, 95% CI via ±1.96·se_diff.
