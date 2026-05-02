import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsSchema1745600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // §5.1.12 — push_subscriptions table
    await queryRunner.query(`
      CREATE TABLE push_subscriptions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint    TEXT NOT NULL UNIQUE,
        keys_p256dh TEXT NOT NULL,
        keys_auth   TEXT NOT NULL,
        user_agent  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id)
    `);

    // §5.1.12 — notifications_sent table
    await queryRunner.query(`
      CREATE TABLE notifications_sent (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        habit_id       UUID REFERENCES habits(id) ON DELETE SET NULL,
        channel        TEXT NOT NULL,
        variant_key    TEXT,
        template_key   TEXT NOT NULL,
        rendered_body  TEXT,
        sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        delivered_at   TIMESTAMPTZ,
        opened_at      TIMESTAMPTZ,
        CONSTRAINT notifications_channel_valid CHECK (channel IN ('web_push', 'email'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_sent_variant
        ON notifications_sent (variant_key, sent_at DESC)
        WHERE variant_key IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_sent_user
        ON notifications_sent (user_id, sent_at DESC)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE notifications_sent IS
        'Durable record of every notification dispatched. Used for experiment analysis (open rate by variant) and for user-facing "notification history".'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // forward-only migration
  }
}
