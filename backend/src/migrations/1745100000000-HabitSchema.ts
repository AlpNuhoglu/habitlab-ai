import type { MigrationInterface, QueryRunner } from 'typeorm';

// Forward-only migration per project conventions. No down() implementation.
export class HabitSchema1745100000000 implements MigrationInterface {
  name = 'HabitSchema1745100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ─── habit_frequency_type ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE habit_frequency_type AS ENUM ('daily', 'weekly', 'custom')
    `);

    // ─── habit_log_status ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE habit_log_status AS ENUM ('completed', 'skipped')
    `);

    // ─── habits ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE habits (
          id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name                   TEXT NOT NULL,
          description            TEXT,
          frequency_type         habit_frequency_type NOT NULL,
          weekday_mask           SMALLINT,                     -- bit 0=Mon..bit 6=Sun (weekly only)
          target_count_per_week  SMALLINT,                     -- custom only
          preferred_time         TIME,                         -- user's local time
          difficulty             SMALLINT NOT NULL DEFAULT 3,  -- 1 (easy) .. 5 (hard)
          is_active              BOOLEAN NOT NULL DEFAULT true,
          archived_at            TIMESTAMPTZ,
          created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT habits_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
          CONSTRAINT habits_description_length CHECK (description IS NULL OR char_length(description) <= 500),
          CONSTRAINT habits_difficulty_range CHECK (difficulty BETWEEN 1 AND 5),
          CONSTRAINT habits_weekday_mask_range CHECK (weekday_mask IS NULL OR weekday_mask BETWEEN 0 AND 127),
          CONSTRAINT habits_target_per_week_range CHECK (target_count_per_week IS NULL OR target_count_per_week BETWEEN 1 AND 7),
          CONSTRAINT habits_weekly_requires_mask CHECK (
              frequency_type <> 'weekly' OR weekday_mask IS NOT NULL
          ),
          CONSTRAINT habits_custom_requires_target CHECK (
              frequency_type <> 'custom' OR target_count_per_week IS NOT NULL
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_habits_user_active
          ON habits (user_id, created_at DESC)
          WHERE archived_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_habits_user_all
          ON habits (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_habits_updated_at
          BEFORE UPDATE ON habits
          FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
    `);

    await queryRunner.query(`
      COMMENT ON TABLE habits IS
        'Habit definitions owned by users. Archiving is soft (archived_at set); hard-delete is permitted only within 30 days of creation.'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN habits.weekday_mask IS
        'Bit 0=Monday, bit 6=Sunday. NULL for daily/custom. E.g. MWF = 0b0010101 = 21.'
    `);

    // ─── habit_logs ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE habit_logs (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          habit_id   UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
          user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          log_date   DATE NOT NULL,
          status     habit_log_status NOT NULL,
          note       TEXT,
          logged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT habit_logs_note_length CHECK (note IS NULL OR char_length(note) <= 500),
          CONSTRAINT habit_logs_unique_per_day UNIQUE (habit_id, log_date)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_habit_logs_user_date
          ON habit_logs (user_id, log_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_habit_logs_habit_date
          ON habit_logs (habit_id, log_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_habit_logs_completions
          ON habit_logs (user_id, log_date DESC)
          WHERE status = 'completed'
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_habit_logs_updated_at
          BEFORE UPDATE ON habit_logs
          FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
    `);

    await queryRunner.query(`
      COMMENT ON TABLE habit_logs IS
        'Daily completion/skip record. Unique per (habit, date). user_id denormalized to avoid join on every analytics query.'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only. Write a new migration to reverse this change.
  }
}
