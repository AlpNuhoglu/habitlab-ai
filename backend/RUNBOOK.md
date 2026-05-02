# HabitLab AI — Operations Runbook

This document covers day-to-day operational procedures for the HabitLab AI backend.

---

## DB backup and restore

### Backup

```bash
# Full logical backup (plain SQL)
pg_dump "$DATABASE_URL" --no-owner --no-acl -f habitlab_$(date +%Y%m%d_%H%M%S).sql

# Compressed
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f habitlab_$(date +%Y%m%d_%H%M%S).dump
```

### Restore

```bash
# From plain SQL
psql "$DATABASE_URL" < habitlab_YYYYMMDD_HHMMSS.sql

# From compressed dump (restores to a blank database)
pg_restore -d "$DATABASE_URL" --no-owner -Fc habitlab_YYYYMMDD_HHMMSS.dump
```

**Notes:**
- `audit_log` is append-only by design. In production, revoke UPDATE/DELETE from the app role before restoring.
- Always test the restore on a staging instance before running against production.

---

## Secret rotation

### JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`)

1. Generate new secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Update the environment variable in Cloud Run / Secret Manager.
3. Deploy the new revision.
4. All active sessions are immediately invalidated — users must log in again. This is by design (stateless JWT).

### VAPID keys (push notifications)

1. Generate a new key pair: `npx web-push generate-vapid-keys`
2. Update `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in the environment.
3. Deploy.
4. Existing push subscriptions become invalid — users must re-subscribe in the browser. The scheduler will receive `410 Gone` responses and auto-clean stale subscriptions.

### Database password

1. Change the password in Postgres: `ALTER USER habitlab WITH PASSWORD 'new_password';`
2. Update `DATABASE_URL` in the environment.
3. Deploy. TypeORM reconnects on the next connection pool cycle.

### OpenAI API key

1. Revoke the old key in the OpenAI dashboard.
2. Create a new key and update `OPENAI_API_KEY` in the environment.
3. Deploy. No downtime — new key is picked up on the next LLM call.

---

## Alert runbook

### Alert: DB unreachable (`GET /ready` returns 503 with `"postgres":"fail"`)

**Symptoms:** `GET /ready` returns `503 {"status":"degraded","checks":{"postgres":"fail"}}`. All write endpoints fail with 500.

**Immediate steps:**
1. Check Postgres container/service health: `pg_isready -h <host> -U habitlab -d habitlab_dev`
2. Check Cloud SQL / RDS status page for the region.
3. If the DB is up but unreachable, check VPC firewall rules and connection pool limits.
4. Check `pg_stat_activity` for lock contention: `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';`
5. If connection pool is exhausted, restart the backend replica — TypeORM will reconnect.

**Escalation:** If DB is genuinely down, the outbox pattern means no events are lost — events are written in the same transaction as state changes, so partial writes are rolled back. Analytics will lag behind but catch up automatically when the DB recovers.

---

### Alert: High error rate (`http_request_errors_total` spike)

**Symptoms:** `http_request_errors_total` counter growing significantly faster than `http_requests_total`. Error rate > 5% sustained for 5 minutes.

**Immediate steps:**
1. Check `GET /health` — if 200, the process is alive.
2. Check `GET /ready` — if 503, a dependency (DB/Redis) is down. Follow DB/Redis runbooks.
3. Look at pino logs for the error pattern:
   - `status:500` with `"context":"ExceptionsHandler"` → unhandled exceptions (check for recent deploy)
   - `status:401` spike → token clock skew or JWT secret rotation
   - `status:422/400` spike → client-side input validation issue
4. If caused by a bad deploy, roll back the Cloud Run revision to the last known-good.
5. Check `llm:circuit:open` in Redis — if set, the LLM circuit is open. This is expected under LLM failure and does not cause user-facing errors (rule-based fallback is used).

---

### Alert: LLM daily budget exceeded

**Symptoms:** `habitlab_llm_cost_cents_total` gauge approaching `OPENAI_DAILY_BUDGET_CENTS` (default 300 = $3). Or the system budget Redis key `llm:cost:cents:YYYY-MM-DD` hits the limit, causing all AI recommendation generation to fall back to rule-based.

**Immediate steps:**
1. Check the Redis key: `redis-cli GET llm:cost:cents:$(date +%Y-%m-%d)`
2. The key expires at midnight UTC automatically (24-hour window resets).
3. If cost is unexpectedly high, check for runaway recommendation generation:
   - Query: `SELECT COUNT(*), SUM(llm_cost_cents) FROM recommendations WHERE source='ai' AND created_at > now() - interval '1 day' GROUP BY user_id ORDER BY 2 DESC LIMIT 10;`
4. To raise the daily budget: update `OPENAI_DAILY_BUDGET_CENTS` in the environment and redeploy.
5. To disable AI recommendations temporarily: set `ai_recommendations_enabled=false` in user preferences (or add a global feature flag — not yet implemented as of WP10).

**Note:** When the budget is exceeded, recommendations still work — they use the rule-based engine as fallback. Users are not affected functionally.

---

## Incident response

### Severity definitions

| Sev | Definition | Response time |
|-----|-----------|---------------|
| P1 | `GET /ready` 503 — all writes failing | Immediate (< 15 min) |
| P2 | Error rate > 10% for > 5 min | < 1 hour |
| P3 | LLM budget exhausted, analytics lag | < 4 hours |
| P4 | Non-critical background worker stalled | Next business day |

### Standard incident response steps

1. **Detect**: alert fires or `GET /ready` / `GET /metrics` indicates a problem.
2. **Acknowledge**: assign an owner, open an incident channel.
3. **Assess blast radius**: is data loss possible? Is auth broken? Are write paths blocked?
4. **Mitigate first, investigate later**: roll back a bad deploy, restart a crashed process, or redirect traffic — don't wait for root cause if mitigation is low-risk.
5. **Fix**: once mitigated, identify root cause via logs (`request_id` correlation, pino JSON logs).
6. **Verify**: confirm `GET /ready` returns 200, `http_request_errors_total` rate normalises.
7. **Post-mortem** (P1/P2): document timeline, root cause, and preventive action within 48 hours.

### Useful diagnostic commands

```bash
# Tail structured logs (Cloud Run)
gcloud logging read 'resource.type="cloud_run_revision"' --format=json | jq '.[] | .jsonPayload'

# Check Redis circuit breaker
redis-cli GET llm:circuit:open
redis-cli GET llm:circuit:errors

# Check LLM cost for today
redis-cli GET "llm:cost:cents:$(date +%Y-%m-%d)"

# Count active push subscriptions
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM push_subscriptions WHERE user_id IS NOT NULL;"

# Active A/B experiments
psql "$DATABASE_URL" -c "SELECT key, status, created_at FROM experiments WHERE status = 'running';"

# Unprocessed events (outbox backlog)
psql "$DATABASE_URL" -c "SELECT COUNT(*), MIN(occurred_at) FROM events WHERE published_at IS NULL;"
```
