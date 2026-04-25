import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import type { BrokerAdapter, OutboxEvent } from './broker-adapter.interface';

export const REDIS_CLIENT = Symbol('RedisClient');

@Injectable()
export class RedisStreamsBrokerAdapter implements BrokerAdapter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(event: OutboxEvent): Promise<void> {
    await this.redis.xadd(
      'habitlab:events',
      '*',
      'id', event.id,
      'user_id', event.userId,
      'event_type', event.eventType,
      'aggregate_type', event.aggregateType,
      'aggregate_id', event.aggregateId ?? '',
      'payload', JSON.stringify(event.payload),
      'occurred_at', event.occurredAt.toISOString(),
    );
  }
}
