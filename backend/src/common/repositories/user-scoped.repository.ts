import type { Repository } from 'typeorm';

/**
 * Marker base class for repositories over user-owned tables (NFR-038).
 *
 * IMPORTANT — this class enforces nothing at runtime or compile time. It injects
 * no filter, intercepts no query, and cannot require a `userId` parameter. It
 * marks intent: every public method on a subclass must take a userId and filter
 * by it, and every query must carry `WHERE user_id = $n` (paired with the row id
 * on single-row lookups, so `{ id, userId }` rather than `{ id }`).
 *
 * The invariant is enforced by three things outside this file:
 *  1. `backend/scripts/check-query-scoping.mjs`, run in CI — fails the build on a
 *     query against a user-owned table that does not reference user_id.
 *  2. `backend/test/cross-tenant.e2e-spec.ts` — asserts one user cannot reach
 *     another user's rows through any id-parameter endpoint.
 *  3. Code review.
 *
 * Since NFR-038 there is also a database-level backstop: PostgreSQL RLS is
 * enabled and forced on every user-owned table, and the application connects as
 * `habitlab_app`, a role that is neither superuser nor BYPASSRLS. A query that
 * forgets its user_id filter now returns zero rows rather than another tenant's.
 *
 * That backstop does not make the filters optional. RLS fails closed, so a
 * missing filter turns a leak into missing data — safer, but still a bug, and
 * one that surfaces as an empty screen rather than an error. Keep writing the
 * filter; the database is the second line, not the first.
 */
export abstract class UserScopedRepository<T extends object> {
  protected abstract readonly repo: Repository<T>;
}
