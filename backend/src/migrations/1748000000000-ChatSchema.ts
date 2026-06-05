import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatSchema1748000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chat_messages (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role        TEXT        NOT NULL,
        content     TEXT        NOT NULL,
        llm_model   TEXT,
        tokens_in   INTEGER,
        tokens_out  INTEGER,
        cost_cents  NUMERIC(10, 4),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chat_messages_role_valid CHECK (role IN ('user', 'assistant'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_chat_messages_user_time
        ON chat_messages (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE chat_messages IS
        'Stores the full conversation history between users and the AI Coach. Used for multi-turn context (last 6 messages), per-user quota enforcement, and cost telemetry.'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // forward-only migration
  }
}
