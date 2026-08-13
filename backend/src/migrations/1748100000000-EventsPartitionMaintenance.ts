import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `events` partitions in InitAuthSchema were hand-written and stopped at
 * 2026-07-01, so every insert past that date failed with "no partition of
 * relation events found for row" — and because events are written in the same
 * transaction as the state change (outbox pattern), the entire write rolled
 * back. Logins, habit toggles and recommendation writes were all failing.
 *
 * This replaces hand-maintained partitions with a function the application
 * calls on a schedule. Creating partitions is the responsibility of running
 * code, not of a migration authored months earlier.
 */
export class EventsPartitionMaintenance1748100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: safe to call on every boot and from concurrent instances.
    // Takes any timestamp and ensures the month-partition containing it exists.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ensure_events_partition(target TIMESTAMPTZ)
      RETURNS void AS $$
      DECLARE
          start_ts  TIMESTAMPTZ := date_trunc('month', target);
          end_ts    TIMESTAMPTZ := date_trunc('month', target) + INTERVAL '1 month';
          part_name TEXT        := 'events_' || to_char(start_ts, 'YYYY_MM');
      BEGIN
          IF to_regclass(part_name) IS NOT NULL THEN
              RETURN;
          END IF;

          EXECUTE format(
              'CREATE TABLE %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
              part_name, start_ts, end_ts
          );
      EXCEPTION
          -- A concurrent instance won the race; the partition now exists.
          WHEN duplicate_table THEN RETURN;
          WHEN invalid_object_definition THEN RETURN;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION ensure_events_partition(TIMESTAMPTZ) IS
        'Idempotently creates the monthly events partition containing the given timestamp. Called by OutboxPublisher on boot and daily.'
    `);

    // Backfill the gap (2026-07 onward) plus a forward buffer, so the system is
    // covered even if the scheduled maintenance never runs.
    await queryRunner.query(`
      DO $$
      DECLARE
          m TIMESTAMPTZ := date_trunc('month', now()) - INTERVAL '3 months';
      BEGIN
          WHILE m <= date_trunc('month', now()) + INTERVAL '6 months' LOOP
              PERFORM ensure_events_partition(m);
              m := m + INTERVAL '1 month';
          END LOOP;
      END $$
    `);
  }

  public async down(): Promise<void> {
    // Forward-only.
  }
}
