# Contributing to HabitLab AI

This project is developed by a single person part-time, but the conventions below are written as if a team could form around it. Following them keeps the codebase readable by a six-months-from-now version of the author.

---

## Development cadence

- **Sprint length**: one week. Plan on Monday, retro on Sunday, both lightweight.
- **Backlog**: GitHub Issues with a single Project board — columns: `Backlog`, `In Progress`, `Done`.
- **Definition of done** for an issue: merged to `main`, tests written and passing, feature documented in the appropriate README or `docs/` entry if non-trivial.

---

## Branching and commits

- **Trunk-based**. No long-lived release branches. Short-lived feature branches off `main`, merged via PR after CI passes.
- **Branch naming**: `<type>/<short-description>`, e.g. `feat/auth-register-endpoint`, `fix/dashboard-stale-cache`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/). Prefixes in use: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`.
- **PR titles** reference the work package and any FR/NFR numbers from the spec when applicable. Example: `feat(auth): register + email verification (WP2, FR-001/002)`.
- **Squash-merge** PRs into `main`. The PR title becomes the squashed commit message.

---

## Code style

- **TypeScript strict mode**. `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **No `any`.** Use `unknown` and narrow with type guards or schema validation (Zod).
- **No `@ts-ignore` / `@ts-expect-error`** without a comment explaining why, and with a TODO linking to an issue.
- **ESLint** with `@typescript-eslint/strict` + `@typescript-eslint/stylistic`.
- **Prettier** for formatting. Run `pnpm format` before committing.
- **File naming**: kebab-case (`habit-log.service.ts`).
- **Class names**: PascalCase. **Functions / variables**: camelCase. **DB tables / columns**: snake_case, plural for tables.
- **Comments explain *why*, not *what*.** If the code needs a comment to say what it does, rewrite the code.

---

## Testing

- **Unit tests** for every service. Jest, colocated as `*.spec.ts` next to the source.
- **Integration tests** for every controller. Real Postgres + Redis containers (docker-compose bringup in test setup), not in-memory fakes.
- **E2E tests** for the critical paths: registration → login flow; habit create → log → dashboard update; recommendation generation; A/B assignment.
- **Coverage target**: ≥70% backend, enforced in CI.
- **Run tests**: `pnpm test`. Coverage report: `pnpm test --coverage`.

---

## Security rules

- **No secrets in the repo, ever.** `.env` is `.gitignore`d. Use `@nestjs/config` to load from env.
- **Every repository method filters by `user_id`.** Extend `UserScopedRepository<T>` — do not bypass it.
- **Never read auth tokens from JavaScript-accessible storage.** Cookies only (`httpOnly` + `SameSite=Strict`).
- **Parameterized queries only.** TypeORM or pg library, never string concat into SQL.
- **New dependencies**: `pnpm audit` clean; Dependabot PRs reviewed within a week.

---

## Data-layer rules

- **All schema changes are migrations.** TypeORM migrations in `backend/src/migrations/`.
- **Migrations are forward-only** (no `down()` method). A bad migration is fixed by a new forward migration, not a rollback.
- **Expand–contract** for breaking changes. Add the new shape in one PR; dual-write and backfill; flip reads; drop the old shape in a later PR.
- **Every mutable table has `created_at` and `updated_at`** (`timestamptz`) and a trigger to maintain `updated_at`.
- **Events are append-only.** No `UPDATE` or `DELETE` on the `events` table from application code.

---

## PR review checklist

Before opening a PR, confirm:

- [ ] CI green locally (`pnpm lint && pnpm typecheck && pnpm test`).
- [ ] If the change touches an API shape, OpenAPI spec regenerated and frontend types re-emitted.
- [ ] If the change touches the DB, a migration is included and tested on a fresh DB.
- [ ] If the change introduces a new feature, tests cover the happy path **and** at least one negative path.
- [ ] No secrets in the diff (`gitleaks` pre-commit hook should catch this).
- [ ] PR description links to the WP and FR/NFR numbers from the spec.
- [ ] `CLAUDE.md` updated if a new non-negotiable decision has been made.

---

## Using Claude Code on this repo

- **Start every session with Claude reading `CLAUDE.md`.** If the session didn't pick it up, `@CLAUDE.md` to inject it.
- **Use plan mode** (Shift+Tab in the VS Code extension) for anything that touches more than ~5 files.
- **Reference spec sections by number** (e.g., "implement per section 5.1.6") rather than paraphrasing. The doc is the source of truth; Claude has access via `docs/HabitLab_AI_Analysis_Report.docx`.
- **Don't let Claude invent columns or endpoints.** If it proposes something not in the spec, either update the spec first or tell Claude to stick to what's specified.

---

## Deployment (later)

Production deploy workflow is not wired up until WP10. Until then, staging will be set up at the end of Phase 2.
