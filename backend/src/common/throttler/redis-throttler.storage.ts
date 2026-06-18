import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

// Structural shape of @nestjs/throttler's ThrottlerStorageRecord. Declared
// locally to avoid importing from the package's internal /dist path.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
}

/**
 * Redis-backed throttler storage. Counters are shared across all backend
 * instances and survive restarts, so the limit holds for the whole cluster
 * rather than per-process (which an attacker could bypass by spreading load
 * across replicas).
 *
 * The window is implemented as a fixed window: the first hit for a key sets
 * the counter to 1 with a TTL of `ttl` seconds; subsequent hits within the
 * window INCR the same key. When the key expires the window resets.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly prefix = 'throttle:';

  constructor(private readonly redis: Redis) {}

  // `ttlMs` is the window length in milliseconds (throttler v5 passes the
  // configured ttl straight through). `timeToExpire` is returned in seconds —
  // it feeds the Retry-After / X-RateLimit-Reset headers.
  async increment(key: string, ttlMs: number): Promise<ThrottlerStorageRecord> {
    const redisKey = `${this.prefix}${key}`;

    // INCR returns the post-increment value; a return of 1 means this is the
    // first hit of a fresh window, so we set the expiry. Both run in one
    // round-trip via a pipeline to keep the operation effectively atomic.
    const results = await this.redis
      .multi()
      .incr(redisKey)
      .pttl(redisKey)
      .exec();

    const totalHits = Number(results?.[0]?.[1] ?? 0);
    let timeToExpireMs = Number(results?.[1]?.[1] ?? -1);

    // -1 = key exists with no expiry (shouldn't happen, but guard anyway),
    // -2 = key did not exist. In both cases (re)apply the window TTL.
    if (totalHits === 1 || timeToExpireMs < 0) {
      await this.redis.pexpire(redisKey, ttlMs);
      timeToExpireMs = ttlMs;
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpireMs / 1000),
    };
  }
}
