# Runbook — RLS application role (`habitlab_app`)

Covers deploying row level security (NFR-038) to a new environment and rotating
the application role's password afterwards.

**Read this first:** shipping RLS is a **credential change in every
environment**, not just a migration. A deploy that applies the migrations
without also setting `APP_DATABASE_URL` will fail at boot — by design.

---

## What changed

The application used to connect as `habitlab`, which owns every table and is a
superuser. Both bypass RLS, so policies would have enforced nothing.

There are now two roles:

| Role | Env var | Used by | RLS |
|---|---|---|---|
| `habitlab` | `DATABASE_URL` | Migrations, outbox publisher, analytics/recommendation workers, notification scheduler, audit writes, auth flows, CLI | Bypasses, via an explicit `_privileged_bypass` policy |
| `habitlab_app` | `APP_DATABASE_URL` | Every HTTP request | Enforced |

`APP_DB_PASSWORD` is read by the `RlsAppRole` migration when it creates or
updates the role. It must match the password embedded in `APP_DATABASE_URL`.

---

## First deploy to an environment

Order matters: the role has to exist before the application tries to use it.

1. **Choose a password** and store it wherever that environment keeps secrets.
   Never commit it. `.env.example` carries a local-only placeholder.

2. **Set all three variables** in the deploy environment:
   ```
   DATABASE_URL=postgresql://habitlab:<owner-password>@<host>:5432/<db>
   APP_DATABASE_URL=postgresql://habitlab_app:<app-password>@<host>:5432/<db>
   APP_DB_PASSWORD=<app-password>
   ```

3. **Run migrations** with `APP_DB_PASSWORD` present:
   ```bash
   pnpm --filter backend migrate
   ```
   Without it, `RlsAppRole` throws with an explanatory message rather than
   creating a role with an unknown password.

4. **Verify before releasing traffic:**
   ```bash
   psql "$APP_DATABASE_URL" -c \
     "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;"
   ```
   Both flags must be `f`. The application asserts this at boot anyway
   (`assertRlsRole`) and refuses to start otherwise, but checking first turns a
   failed deploy into a caught mistake.

5. **Deploy the application.** It will not start if `APP_DATABASE_URL` is
   missing or points at a privileged role.

### Local development

`pnpm db:up && pnpm --filter backend migrate` with the committed `.env` is
enough. Note that an **existing** local database created before this change has
no `habitlab_app` until migrations are re-run — the boot error says exactly
that. `docker/postgres/init/` scripts only run on a first boot of an empty
volume, which is why the role comes from a migration instead.

---

## Rotating the password

The role is not recreated, so there is no window without it. Rotate in this
order:

1. Set `APP_DB_PASSWORD` to the **new** value.
2. Re-run `pnpm --filter backend migrate`. `RlsAppRole` is idempotent: on an
   existing role it takes the `ALTER ROLE` branch, resetting the password and
   re-asserting `NOSUPERUSER NOBYPASSRLS`.
3. Update `APP_DATABASE_URL` with the same new password.
4. Restart the application so pooled connections are re-established. Existing
   connections keep working until then — PostgreSQL checks the password at
   connect time, not per query — so there is no hard cutover, but a
   long-lived pool will not pick up the change on its own.

Steps 2 and 3 must not be separated by a deploy: between them, the running
application still holds valid connections but could not open a new one.

---

## Troubleshooting

**`Application pool is connected as 'habitlab', which bypasses row level
security`**
`APP_DATABASE_URL` is unset or points at the owner. The application falls back
to `DATABASE_URL` so a developer with a stale database still gets a clear error
instead of a confusing connection failure — this assertion is that error.

**`APP_DB_PASSWORD is required to run this migration`**
Running migrations without the variable set. See step 3 above.

**`permission denied for table <x>`**
The app role has no grant on that table. Some of these are intentional:
`refresh_tokens` (authentication infrastructure, read without a `user_id` for
reuse detection), `audit_log` (`INSERT` only), `processed_events`. If it is a
new table, add the grant in a new migration — and add a policy if it has a
`user_id`.

**A query returns nothing that used to return rows**
The most likely cause is a missing tenant in context rather than missing data.
RLS fails closed, so an unset `app.current_user_id` yields zero rows. Check
whether the code path runs outside an HTTP request; if it acts on one user's
behalf, wrap it in `runAsTenant(userId, …)`.

**Writes to `events` start failing with "no partition of relation events found"**
`ensure_events_partition` is `SECURITY DEFINER` so `habitlab_app` can run it
despite lacking DDL rights. If that were ever lost, `OutboxPublisher` logs the
failure and continues, so the symptom appears roughly a month later when
coverage runs out. `rls.e2e-spec.ts` guards it.
