import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the de-privileged role the application connects as, so row level
 * security has something to enforce against (NFR-038).
 *
 * Until now the app connected as `habitlab`, which owns every table and is a
 * superuser. Both of those bypass RLS — an owner by default, a superuser
 * unconditionally, even with FORCE. Enabling policies without this role first
 * would produce a policy set that looks active in \d+ and enforces nothing,
 * which is worse than no RLS because it manufactures confidence.
 *
 * This lives in a migration rather than docker/postgres/init/ for two reasons:
 * CI mounts no init scripts at all, and init scripts only run on the first boot
 * of an empty volume, so existing developer databases would never see it.
 * InitAuthSchema set the same precedent for the extensions.
 */
export class RlsAppRole1748200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const password = process.env['APP_DB_PASSWORD'];
    if (!password) {
      throw new Error(
        'APP_DB_PASSWORD is required to run this migration. It is the login password ' +
          'for the de-privileged habitlab_app role that the application connects as; ' +
          'APP_DATABASE_URL must embed the same value.',
      );
    }

    // A DO block takes no bind parameters, so the password is handed over as a
    // session setting and read back inside the block with current_setting().
    // format(%L) quotes it into the EXECUTE, so the credential never appears in
    // this file and never reaches the server as literal SQL text.
    await queryRunner.query(`SELECT set_config('habitlab.app_password', $1, true)`, [password]);

    // NOBYPASSRLS is the point of the exercise. The ELSE branch re-asserts it on
    // an existing role, so a hand-granted bypass does not survive a redeploy.
    await queryRunner.query(
      `DO $$
       DECLARE pw TEXT := current_setting('habitlab.app_password');
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'habitlab_app') THEN
           EXECUTE format(
             'CREATE ROLE habitlab_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L',
             pw
           );
         ELSE
           EXECUTE format(
             'ALTER ROLE habitlab_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L',
             pw
           );
         END IF;
       END $$`,
    );

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO habitlab_app`);

    // Tables whose isolation is enforced by policy: full DML, since the policy
    // decides which rows are reachable.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON
        habits, habit_logs, habit_analytics, user_analytics, chat_messages,
        recommendations, push_subscriptions, notifications_sent, experiment_assignments
      TO habitlab_app
    `);

    // events is partitioned, and GRANT on a partitioned parent does NOT cascade
    // to its partitions. That is deliberate and load-bearing: RLS leaves
    // relrowsecurity false on each child, so the only thing stopping a direct
    // `SELECT ... FROM events_2026_09` is the absence of a grant on it. Never
    // add grants inside ensure_events_partition().
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON events TO habitlab_app`);

    // Append-only, exactly as InitAuthSchema anticipated. audit_log.user_id is
    // nullable (a failed login has no user), so an equality policy would hide
    // system rows from everyone; withholding SELECT is the stronger control.
    await queryRunner.query(`GRANT INSERT ON audit_log TO habitlab_app`);

    // users is not policy-protected: login and password reset must read by
    // email before any tenant exists. Isolation here stays the application's
    // job, which is why check-query-scoping does not treat it as user-owned.
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON users TO habitlab_app`);

    // Global A/B configuration with no user_id, so there is nothing to isolate
    // and no policy to write. Read-only: variant assignment reads it on the
    // request path, while creating and starting experiments is operator work
    // done through the CLI on the privileged pool.
    await queryRunner.query(`GRANT SELECT ON experiments TO habitlab_app`);

    // Sequences backing the granted tables.
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO habitlab_app`,
    );

    // Deliberately never granted: refresh_tokens (authentication infrastructure,
    // read without a user_id for reuse detection), processed_events (worker
    // idempotency ledger), migrations, and every events_* partition.

    // ensure_events_partition runs CREATE TABLE, which habitlab_app cannot do.
    // SECURITY DEFINER runs it as the owner instead. Without this the DDL fails
    // and OutboxPublisher swallows the error, so partition coverage would run
    // out silently and every write would begin failing a month later.
    //
    // The pinned search_path is mandatory for any SECURITY DEFINER function:
    // without it a caller can prepend a schema and hijack the unqualified
    // to_regclass/format/date_trunc calls in the body. pg_temp goes last so
    // temporary objects cannot shadow anything.
    await queryRunner.query(`
      ALTER FUNCTION ensure_events_partition(TIMESTAMPTZ)
        SECURITY DEFINER
        SET search_path = public, pg_temp
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION ensure_events_partition(TIMESTAMPTZ) FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION ensure_events_partition(TIMESTAMPTZ) TO habitlab_app`,
    );
  }

  public async down(): Promise<void> {
    // Forward-only. Write a new migration to reverse this change.
  }
}
