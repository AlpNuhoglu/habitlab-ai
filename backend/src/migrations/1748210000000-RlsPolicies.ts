import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables row level security on every user-owned table (NFR-038).
 *
 * Application-layer `WHERE user_id = $n` filtering stays exactly as it is; this
 * adds a second, independent boundary underneath it, so a query that forgets
 * its filter returns zero rows instead of another tenant's.
 *
 * Two tables from the user-owned set are deliberately absent:
 *
 *  - refresh_tokens: /auth/refresh is @Public(), so no tenant is in context
 *    when it runs, and findByHash queries without a user_id on purpose because
 *    reuse detection needs revoked rows (FR-004). A policy here would return
 *    null and break every session refresh. It is unreachable from the app pool
 *    instead — no grant at all.
 *  - audit_log: user_id is nullable, so an equality policy would hide
 *    system-actor rows from everyone. Held append-only by grants instead.
 */
const RLS_TABLES = [
  'habits',
  'habit_logs',
  'habit_analytics',
  'user_analytics',
  'chat_messages',
  'recommendations',
  'push_subscriptions',
  'notifications_sent',
  'experiment_assignments',
  'events',
];

export class RlsPolicies1748210000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of RLS_TABLES) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      // FORCE so the table owner is subject to policy too. Without it, owners
      // bypass silently — and migrations, workers and psql all connect as the
      // owner, so most of the system would never be checked.
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table}`);
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_privileged_bypass ON ${table}`);

      // NULLIF(...,'') is required, not cosmetic: RlsClient writes an empty
      // string when no tenant is in context, and a bare ''::uuid raises
      // invalid_text_representation, turning a fail-closed read into a 500.
      // The `true` (missing_ok) argument likewise stops an unset GUC raising
      // undefined_object. Both paths must land on NULL, which never matches a
      // row — zero rows, never all rows.
      //
      // WITH CHECK matters as much as USING: without it, RLS would restrict
      // reads while still permitting a write attributed to another user.
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_isolation ON ${table}
          FOR ALL
          TO habitlab_app
          USING      (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
      `);

      // FORCE applies to the owner as well, and a policy scoped TO habitlab_app
      // does not match it — which would leave the owner forced into RLS with no
      // policy at all, i.e. zero rows, breaking every worker and migration.
      // This states the bypass explicitly instead. Policies are OR'd, so the
      // effect matches PostgreSQL's default owner bypass, except that it is now
      // visible in \d+ and greppable in this repo.
      await queryRunner.query(`
        CREATE POLICY ${table}_privileged_bypass ON ${table}
          FOR ALL
          TO habitlab
          USING (true)
          WITH CHECK (true)
      `);
    }

    // events is PARTITION BY RANGE. Each child will show relrowsecurity = false
    // in pg_class — that is expected, not a bug to fix. Enforcement happens at
    // the parent during planning and automatically covers partitions created
    // later by ensure_events_partition(). Direct access to a child is blocked by
    // the absence of a GRANT on it, since GRANT on a partitioned parent does not
    // cascade, so grants must never be added inside that function.
    await queryRunner.query(`
      COMMENT ON TABLE events IS
        'Append-only domain event log, partitioned by month on occurred_at. RLS is enforced at the parent; partitions intentionally carry no policy and no grant.'
    `);
  }

  public async down(): Promise<void> {
    // Forward-only. Write a new migration to reverse this change.
  }
}
