import { Injectable } from '@nestjs/common';

import type { ICacheService } from './cache.interface';

@Injectable()
export class NullCacheAdapter implements ICacheService {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set(_key: string, _value: unknown, _ttlSeconds: number): Promise<void> {
    // no-op in test / stub mode
  }

  async del(_key: string): Promise<void> {
    // no-op in test / stub mode
  }
}
