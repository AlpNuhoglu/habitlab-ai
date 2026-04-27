import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecommendationsSchema1745400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE recommendation_source AS ENUM ('rule', 'ai');
    `);

    await queryRunner.query(`
      CREATE TYPE recommendation_status AS ENUM ('active', 'dismissed', 'accepted', 'expired');
    `);

    await queryRunner.query(`
      CREATE TABLE recommendations (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        habit_id           UUID REFERENCES habits(id) ON DELETE CASCADE,
        source             recommendation_source NOT NULL,
        category           TEXT NOT NULL,
        title              TEXT NOT NULL,
        body               TEXT NOT NULL,
        action_payload     JSONB,
        priority           SMALLINT NOT NULL DEFAULT 50,
        status             recommendation_status NOT NULL DEFAULT 'active',
        experiment_variant TEXT,
        llm_model          TEXT,
        llm_tokens_input   INTEGER,
        llm_tokens_output  INTEGER,
        llm_cost_cents     NUMERIC(10, 4),
        expires_at         TIMESTAMPTZ,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at        TIMESTAMPTZ,
        CONSTRAINT recommendations_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
        CONSTRAINT recommendations_body_length  CHECK (char_length(body) BETWEEN 1 AND 500),
        CONSTRAINT recommendations_priority_range CHECK (priority BETWEEN 0 AND 100)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_recommendations_user_active
        ON recommendations (user_id, priority DESC, created_at DESC)
        WHERE status = 'active';
    `);

    await queryRunner.query(`
      CREATE INDEX idx_recommendations_cooldown
        ON recommendations (user_id, habit_id, category, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_recommendations_expiry
        ON recommendations (expires_at)
        WHERE status = 'active' AND expires_at IS NOT NULL;
    `);

    await queryRunner.query(`
      COMMENT ON TABLE recommendations IS
        'Generated insight objects surfaced to the user. Rule-based and AI-generated rows coexist; source indicates origin.';
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // forward-only
  }
}
