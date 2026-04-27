// §6.4.1 — Redis key inventory. All keys scoped to avoid collisions.
export const CacheKeys = {
  dashboard: (userId: string) => `dashboard:${userId}`,
  analyticsGlobal: (userId: string) => `analytics:${userId}:global`,
  analyticsHabit: (userId: string, habitId: string) => `analytics:${userId}:habit:${habitId}`,
} as const;
