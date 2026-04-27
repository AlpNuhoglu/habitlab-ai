import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '../../infrastructure/broker/redis-streams-broker.adapter';

// §6.3.4 — error window for circuit breaker
const CIRCUIT_ERROR_WINDOW_S = 60;
const CIRCUIT_ERROR_THRESHOLD = 5;
const CIRCUIT_OPEN_TTL_S = 300; // 5 minutes

// Redis key helpers
const KEY_SYSTEM_COST = (date: string) => `llm:cost:cents:${date}`;
const KEY_CIRCUIT_ERRORS = 'llm:circuit:errors';
const KEY_CIRCUIT_OPEN = 'llm:circuit:open';

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class LlmCostService {
  private readonly logger = new Logger(LlmCostService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // §6.3.4 — Circuit breaker: open if key exists
  async isCircuitOpen(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      return (await this.redis.exists(KEY_CIRCUIT_OPEN)) === 1;
    } catch (err) {
      this.logger.warn(`Circuit breaker check failed: ${String(err)}`);
      return false;
    }
  }

  // §6.3.4 — Per-user-per-day limit: DB-based COUNT (testable without Redis)
  async isUserQuotaExceeded(userId: string, maxPerDay: number): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ cnt: string }>>(
      `SELECT COUNT(*)::text AS cnt
       FROM recommendations
       WHERE user_id = $1
         AND source = 'ai'
         AND created_at > now() - INTERVAL '1 day'`,
      [userId],
    );
    return parseInt(rows[0]?.cnt ?? '0', 10) >= maxPerDay;
  }

  // §6.3.4 — System-wide daily budget check
  async isSystemBudgetExceeded(budgetCents: number): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const val = await this.redis.get(KEY_SYSTEM_COST(utcDateString()));
      return parseFloat(val ?? '0') >= budgetCents;
    } catch (err) {
      this.logger.warn(`Budget check failed: ${String(err)}`);
      return false;
    }
  }

  // Called after a successful LLM call
  async recordSuccess(costCents: number): Promise<void> {
    if (!this.redis) return;
    try {
      const dateKey = KEY_SYSTEM_COST(utcDateString());
      const pipeline = this.redis.pipeline();
      pipeline.incrbyfloat(dateKey, costCents);
      // Expire system cost key after 48h (covers timezone edge cases)
      pipeline.expire(dateKey, 172_800);
      // Reset error counter on success so the window starts fresh
      pipeline.del(KEY_CIRCUIT_ERRORS);
      await pipeline.exec();
    } catch (err) {
      this.logger.warn(`recordSuccess Redis write failed: ${String(err)}`);
    }
  }

  // Called when OpenAI returns an error (before retry or after final failure)
  async recordError(): Promise<void> {
    if (!this.redis) return;
    try {
      const count = await this.redis.incr(KEY_CIRCUIT_ERRORS);
      if (count === 1) {
        // First error in this window — start the 60s expiry
        await this.redis.expire(KEY_CIRCUIT_ERRORS, CIRCUIT_ERROR_WINDOW_S);
      }
      if (count >= CIRCUIT_ERROR_THRESHOLD) {
        await this.redis.set(KEY_CIRCUIT_OPEN, '1', 'EX', CIRCUIT_OPEN_TTL_S);
        this.logger.warn('LLM circuit breaker opened — too many consecutive errors');
      }
    } catch (err) {
      this.logger.warn(`recordError Redis write failed: ${String(err)}`);
    }
  }
}
