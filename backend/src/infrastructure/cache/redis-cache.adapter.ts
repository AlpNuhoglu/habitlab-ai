import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../broker/redis-streams-broker.adapter';
import type { ICacheService } from './cache.interface';

@Injectable()
export class RedisCacheAdapter implements ICacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
