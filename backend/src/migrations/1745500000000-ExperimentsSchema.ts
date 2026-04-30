import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExperimentsSchema1745500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // §5.1.10 — experiment_status enum
    await queryRunner.query(`
      CREATE TYPE experiment_status AS ENUM (
        'draft', 'running', 'paused', 'completed', 'archived'
      )
    `);

    // §5.1.10 — experiments table
    await queryRunner.query(`
      CREATE TABLE experiments (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        key              TEXT        NOT NULL UNIQUE,
        name             TEXT        NOT NULL,
        description      TEXT,
        variants         JSONB       NOT NULL,
        primary_metric   TEXT        NOT NULL,
        guardrail_metrics JSONB      NOT NULL DEFAULT '[]'::jsonb,
        status           experiment_status NOT NULL DEFAULT 'draft',
        starts_at        TIMESTAMPTZ,
        ends_at          TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT experiments_variants_is_array
          CHECK (jsonb_typeof(variants) = 'array'),
        CONSTRAINT experiments_ends_after_starts
          CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
      )
    `);

    // §5.1.10 — experiment_assignments table
    await queryRunner.query(`
      CREATE TABLE experiment_assignments (
        user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        experiment_id UUID        NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        variant_key   TEXT        NOT NULL,
        assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, experiment_id)
      )
    `);

    // §5.1.10 — index for analysis queries
    await queryRunner.query(`
      CREATE INDEX idx_experiment_assignments_exp_variant
        ON experiment_assignments (experiment_id, variant_key)
    `);

    await queryRunner.query(`
      COMMENT ON TABLE experiments IS
        'A/B experiment definitions. A user may be assigned to one variant per experiment; assignments are immutable once written.'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE experiment_assignments IS
        'Deterministic user-variant pairings. Assignment is computed as variants[hash(user_id || experiment_key) mod sum(weights)].'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // forward-only migration
  }
}
