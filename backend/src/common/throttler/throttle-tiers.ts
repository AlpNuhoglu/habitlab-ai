/**
 * Named throttle tiers, applied per-route via the `@Throttle` decorator.
 *
 * `default` is the cluster-wide baseline enforced on every route by the global
 * guard. `auth` and `chat` are stricter overrides for the abuse-prone surfaces:
 * credential stuffing / email bombing on the public auth routes, and LLM
 * cost-amplification on the coach chat route.
 *
 * ttl is in milliseconds (throttler v5 convention).
 */
export const THROTTLE_TIERS = {
  default: { name: 'default', ttl: 60_000, limit: 100 },
  auth: { name: 'auth', ttl: 60_000, limit: 5 },
  chat: { name: 'chat', ttl: 60_000, limit: 10 },
} as const;
