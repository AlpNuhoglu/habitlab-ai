import type { MigrationInterface, QueryRunner } from 'typeorm';

// Forward-only migration per project conventions. No down() implementation.
export class AnalyticsSchema1745300000000 implements MigrationInterface {
  name = 'AnalyticsSchema1745300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // §5.1.8 — user_analytics
    await queryRunner.query(`
      CREATE TABLE user_analytics (
          user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          -- Headline metrics
          completion_rate_7d      NUMERIC(5, 4) NOT NULL DEFAULT 0,
          completion_rate_30d     NUMERIC(5, 4) NOT NULL DEFAULT 0,
          completion_rate_all_time NUMERIC(5, 4) NOT NULL DEFAULT 0,
          -- Streak metrics (the user's best across all active habits)
          longest_streak          INTEGER NOT NULL DEFAULT 0,
          current_longest_streak  INTEGER NOT NULL DEFAULT 0,
          -- Pattern detection
          best_hour_of_day        SMALLINT,
          worst_hour_of_day       SMALLINT,
          best_weekday            SMALLINT,  -- 0=Monday..6=Sunday
          worst_weekday           SMALLINT,
          -- Counts used by the rule engine
          total_logs_30d          INTEGER NOT NULL DEFAULT 0,
          total_completions_30d   INTEGER NOT NULL DEFAULT 0,
          total_skips_30d         INTEGER NOT NULL DEFAULT 0,
          recomputed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      COMMENT ON TABLE user_analytics IS
        'One row per user; refreshed by the analytics worker in response to completion/skip events. Source of truth for the dashboard.'
    `);

    // §5.1.9 — habit_analytics
    await queryRunner.query(`
      CREATE TABLE habit_analytics (
          habit_id              UUID PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
          user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          current_streak        INTEGER NOT NULL DEFAULT 0,
          longest_streak        INTEGER NOT NULL DEFAULT 0,
          completion_rate_7d    NUMERIC(5, 4) NOT NULL DEFAULT 0,
          completion_rate_30d   NUMERIC(5, 4) NOT NULL DEFAULT 0,
          completion_rate_90d   NUMERIC(5, 4) NOT NULL DEFAULT 0,
          -- Distributions stored as jsonb arrays for flexibility
          completion_by_weekday JSONB NOT NULL DEFAULT '[0,0,0,0,0,0,0]'::jsonb,   -- 7-element, Mon=0
          completion_by_hour    JSONB NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb, -- 24-element
          last_completed_at     TIMESTAMPTZ,
          last_skipped_at       TIMESTAMPTZ,
          recomputed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_habit_analytics_user ON habit_analytics (user_id)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE habit_analytics IS
        'Per-habit precomputed aggregates. Populated by the analytics worker on every log event.'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only. Write a new migration to reverse this change.
  }
}
