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
 * There is no database-level backstop: PostgreSQL RLS is not enabled, and the
 * app connects as the table owner (which bypasses RLS policies by default), so
 * application-layer filtering is the only isolation boundary. Enabling RLS is
 * tracked as its own work package.
 */
export abstract class UserScopedRepository<T extends object> {
  protected abstract readonly repo: Repository<T>;
}
