import type { MigrationInterface, QueryRunner } from 'typeorm';

// Forward-only migration per CONTRIBUTING.md. No down() implementation.
// To roll back, write a new forward migration.
export class InitAuthSchema1745000000000 implements MigrationInterface {
  name = 'InitAuthSchema1745000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Extensions ──────────────────────────────────────────────────────────
    // These are idempotent. They also run in docker/postgres/init/01-extensions.sql
    // but migrations must be self-contained for CI (fresh DB).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gin`);

    // ─── touch_updated_at() ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION touch_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
          NEW.updated_at := now();
          RETURN NEW;
      END $$
    `);

    // ─── users ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email                CITEXT NOT NULL,
          password_hash        TEXT NOT NULL,
          display_name         TEXT,
          timezone             TEXT NOT NULL DEFAULT 'UTC',
          locale               TEXT NOT NULL DEFAULT 'en',

          email_verified_at    TIMESTAMPTZ,
          last_login_at        TIMESTAMPTZ,
          consent_given_at     TIMESTAMPTZ NOT NULL,

          preferences          JSONB NOT NULL DEFAULT '{
              "ai_recommendations_enabled": true,
              "experiments_opted_out": false,
              "hints_include_notes": false,
              "quiet_hours": {"start": "22:00", "end": "07:00"}
          }'::jsonb,

          created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at           TIMESTAMPTZ,

          CONSTRAINT users_email_unique UNIQUE (email)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_active_email
          ON users (email)
          WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_deleted_purge
          ON users (deleted_at)
          WHERE deleted_at IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
    `);

    await queryRunner.query(`
      COMMENT ON TABLE users IS
        'Root tenancy table. All user-owned data references users.id. Soft-deleted users are purged after 30 days.'
    `);

    // ─── refresh_tokens ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash  TEXT NOT NULL UNIQUE,
          issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at  TIMESTAMPTZ NOT NULL,
          revoked_at  TIMESTAMPTZ,
          replaced_by UUID REFERENCES refresh_tokens(id),
          ip_address  INET,
          user_agent  TEXT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_refresh_tokens_user_active
          ON refresh_tokens (user_id)
          WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_refresh_tokens_expiry
          ON refresh_tokens (expires_at)
          WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      COMMENT ON TABLE refresh_tokens IS
        'Refresh-token chain. Rotation on each refresh; reuse of a revoked token triggers chain-wide revocation (token-theft response).'
    `);

    // ─── audit_log ───────────────────────────────────────────────────────────
    // Append-only by design. In production, revoke UPDATE/DELETE from the app role:
    //   REVOKE UPDATE, DELETE ON audit_log FROM habitlab_app;
    await queryRunner.query(`
      CREATE TABLE audit_log (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
          actor_type   TEXT NOT NULL,
          action       TEXT NOT NULL,
          target_type  TEXT,
          target_id    UUID,
          details      JSONB,
          ip_address   INET,
          user_agent   TEXT,
          occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_user_time
          ON audit_log (user_id, occurred_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_action_time
          ON audit_log (action, occurred_at DESC)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE audit_log IS
        'Immutable log of security-sensitive actions. App role has INSERT-only grant in production.'
    `);

    // ─── events (partitioned) ────────────────────────────────────────────────
    // No FK on user_id: detaching old partitions would break FK maintenance.
    // Integrity enforced by the application — events are always inserted in the
    // same transaction as the state change they describe (outbox pattern).
    await queryRunner.query(`
      CREATE TABLE events (
          id              UUID NOT NULL DEFAULT gen_random_uuid(),
          user_id         UUID NOT NULL,
          event_type      TEXT NOT NULL,
          aggregate_type  TEXT NOT NULL,
          aggregate_id    UUID,
          payload         JSONB NOT NULL DEFAULT '{}',
          occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          published_at    TIMESTAMPTZ,

          PRIMARY KEY (id, occurred_at)
      ) PARTITION BY RANGE (occurred_at)
    `);

    await queryRunner.query(`
      CREATE TABLE events_2026_04 PARTITION OF events
          FOR VALUES FROM ('2026-04-01') TO ('2026-05-01')
    `);

    await queryRunner.query(`
      CREATE TABLE events_2026_05 PARTITION OF events
          FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    `);

    await queryRunner.query(`
      CREATE TABLE events_2026_06 PARTITION OF events
          FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    `);

    // Indexes on the parent are inherited by partitions (PG14+).
    await queryRunner.query(`
      CREATE INDEX idx_events_unpublished
          ON events (occurred_at)
          WHERE published_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_events_user
          ON events (user_id, occurred_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_events_aggregate
          ON events (aggregate_type, aggregate_id, occurred_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_events_payload
          ON events USING gin (payload jsonb_path_ops)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE events IS
        'Append-only domain event log. Partitioned monthly on occurred_at. Outbox: rows with NULL published_at await broker publication.'
    `);
  }

  // Forward-only migration — no rollback implementation.
  async down(_queryRunner: QueryRunner): Promise<void> {}
}
