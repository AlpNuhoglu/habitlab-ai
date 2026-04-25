import type { MigrationInterface, QueryRunner } from 'typeorm';

// Forward-only migration per project conventions. No down() implementation.
export class ProcessedEventsSchema1745200000000 implements MigrationInterface {
  name = 'ProcessedEventsSchema1745200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE processed_events (
          event_id       UUID NOT NULL,
          consumer_name  TEXT NOT NULL,
          processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (event_id, consumer_name)
      )
    `);

    // No FK on event_id: partitioned tables cannot be FK targets safely
    // (detaching a partition would break the FK). Integrity is enforced by
    // the application — consumers only insert rows for events that exist.
    await queryRunner.query(`
      CREATE INDEX idx_processed_events_consumer
          ON processed_events (consumer_name, processed_at)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE processed_events IS
        'Idempotency table for outbox consumers. No FK to events (partitioned table). Consumers insert here before acting; duplicate delivery is a no-op.'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only. Write a new migration to reverse this change.
  }
}
