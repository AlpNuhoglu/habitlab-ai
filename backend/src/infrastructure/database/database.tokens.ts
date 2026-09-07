/**
 * Injection token for the connection pool that is NOT subject to row level
 * security (NFR-038).
 *
 * The name is deliberately alarming. Asking for this token asserts that the
 * code path legitimately crosses tenant boundaries, and every use is checked
 * against the allowlist in `backend/scripts/check-privileged-datasource.mjs`.
 *
 * Everything else uses the default DataSource, which carries the request's
 * tenant on its session and is constrained by policy. Reach for that first;
 * if a query seems to need this token, the usual cause is a missing tenant in
 * the ambient request context, not a genuine cross-tenant read.
 */
export const PRIVILEGED_DATA_SOURCE = 'PRIVILEGED_DATA_SOURCE_BYPASSES_RLS';
