import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../infrastructure/broker/redis-streams-broker.adapter';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { THROTTLE_TIERS } from './throttle-tiers';

/**
 * Configures cluster-wide rate limiting backed by Redis.
 *
 * In test / stub mode REDIS_CLIENT is null; the guard's `skipIf` then disables
 * throttling entirely so e2e suites — which fire many requests back-to-back —
 * do not flake on 429s. In every other environment the global `default` tier
 * applies, with stricter per-route overrides on the auth and chat surfaces.
 *
 * NOTE: the throttler APP_GUARD is registered in AppModule (not here) so it can
 * be ordered ahead of JwtAuthGuard — global guards execute in registration
 * order, and we want throttling to run before auth so the default tier covers
 * authenticated routes too.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis | null): ThrottlerModuleOptions => {
        const options: ThrottlerModuleOptions = {
          throttlers: [
            {
              name: THROTTLE_TIERS.default.name,
              ttl: THROTTLE_TIERS.default.ttl,
              limit: THROTTLE_TIERS.default.limit,
            },
          ],
          // No Redis (test/stub) → no shared counter store → skip throttling.
          skipIf: () => redis === null,
          errorMessage: 'Too many requests. Please slow down and try again shortly.',
        };
        // Only attach storage when Redis is available; exactOptionalPropertyTypes
        // forbids assigning `undefined` to the optional `storage` field.
        if (redis) options.storage = new RedisThrottlerStorage(redis);
        return options;
      },
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
