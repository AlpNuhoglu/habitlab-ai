import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the application role access to the worker idempotency ledger, so the
 * analytics and recommendation workers can run on the RLS-bound pool (NFR-038).
 *
 * RlsAppRole deliberately withheld this grant, on the reasoning that only
 * privileged workers touch the table. That reasoning was sound while both
 * workers held a permanent RLS bypass, and it is what has now changed: each one
 * processes a single event for a single user, so neither needs to see every
 * tenant. Narrowing them to runAsTenant() moves their dedupe INSERT onto the
 * app pool, which is what requires this grant.
 *
 * The table takes no policy and needs none. It has no user_id to isolate on —
 * the columns are (event_id, consumer_name, processed_at) — and it holds no
 * tenant data, only the fact that a consumer has already handled an event.
 * Isolation here would be meaningless; what matters is that the ledger write
 * stays in the same transaction as the work it guards.
 *
 * SELECT accompanies INSERT because the consumers write via
 * `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id` and read the returned
 * rows to decide whether they won the race. Splitting the ledger onto a second
 * pool to avoid this grant would cost atomicity: a crash between the two
 * transactions either double-processes an event or drops one silently.
 */
export class RlsProcessedEventsGrant1748220000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT INSERT, SELECT ON processed_events TO habitlab_app`);
  }

  public async down(): Promise<void> {
    // Forward-only. Write a new migration to reverse this change.
  }
}
