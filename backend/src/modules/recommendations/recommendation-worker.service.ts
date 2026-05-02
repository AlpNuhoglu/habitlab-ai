import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { OutboxEvent } from '../../infrastructure/broker/broker-adapter.interface';
import { REDIS_CLIENT } from '../../infrastructure/broker/redis-streams-broker.adapter';
import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { CACHE_SERVICE, ICacheService } from '../../infrastructure/cache/cache.interface';
import { LLM_PROVIDER, LLMProvider } from '../../infrastructure/llm/llm-provider.interface';
import { HabitAnalytics } from '../analytics/entities/habit-analytics.entity';
import { AssignmentService } from '../experiments/assignment.service';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { LlmCostService } from './llm-cost.service';
import { buildLlmPrompt } from './llm-prompt.builder';
import { applySafetyFilter } from './llm-safety.filter';
import { RecommendationRepository } from './recommendation.repository';
import { RuleEngineService } from './rule-engine.service';
import { RuleContext, RuleResult } from './rules/rule.interface';

const CONSUMER_NAME = 'recommendations-worker';
const STREAM_KEY = 'habitlab:events';
const CONSUMER_GROUP = 'habitlab-recommendations';
const CONSUMER_ID = 'recommendations-worker-1';
const POLL_BLOCK_MS = 2000;
const BATCH_SIZE = 10;

// §6.3.4 — per-user-per-day AI recommendation cap
const MAX_AI_RECS_PER_USER_PER_DAY = 3;

const HANDLED_EVENTS = new Set(['habit.completed', 'habit.skipped', 'habit.log_updated']);

@Injectable()
export class RecommendationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecommendationWorkerService.name);
  private running = false;
  private active = true;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LLMProvider,
    private readonly ruleEngine: RuleEngineService,
    private readonly recommendationRepo: RecommendationRepository,
    private readonly llmCost: LlmCostService,
    private readonly config: ConfigService,
    private readonly assignmentService: AssignmentService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (this.redis !== null) {
      void this.ensureConsumerGroup().then(() => this.startPollLoop());
    }
  }

  onModuleDestroy(): void {
    this.active = false;
  }

  // ─── Public: called directly in tests ────────────────────────────────────────

  async handleEvent(event: OutboxEvent): Promise<void> {
    if (!HANDLED_EVENTS.has(event.eventType)) return;

    const habitId = event.aggregateId;
    const userId = event.userId;

    if (!habitId) {
      this.logger.warn(`${event.eventType} has no aggregateId — skipping`);
      return;
    }

    // §WP8 — resolve before opening the main transaction; getOrAssignIfActive has its own tx.
    // try/catch: experiments table may not exist if WP8 migration hasn't been applied yet.
    let experimentVariant: string | null = null;
    try {
      experimentVariant = await this.assignmentService.getOrAssignIfActive(userId, 'rec_copy_v1');
    } catch (err) {
      this.logger.warn(`Could not resolve experiment variant for ${userId}: ${String(err)}`);
    }

    let inserted = false;

    await this.dataSource.transaction(async (em) => {
      const dedupe = await em.query<Array<{ event_id: string }>>(
        `INSERT INTO processed_events (event_id, consumer_name)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [event.id, CONSUMER_NAME],
      );

      if (dedupe.length === 0) {
        this.logger.debug(`Duplicate event ${event.id} — skipping`);
        return;
      }

      const analytics = await em.getRepository(HabitAnalytics).findOne({ where: { habitId } });

      if (!analytics) {
        this.logger.warn(
          `No habit_analytics found for habitId ${habitId}, skipping recommendation evaluation`,
        );
        return;
      }

      const habitRows = await em.query<
        Array<{ difficulty: number; preferred_time: string | null; frequency_type: string; name: string }>
      >(
        `SELECT difficulty, preferred_time, frequency_type, name
         FROM habits
         WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
        [habitId, userId],
      );

      if (!habitRows[0]) return;

      const userRows = await em.query<
        Array<{ locale: string; ai_recommendations_enabled: boolean }>
      >(
        `SELECT locale,
                (preferences->>'ai_recommendations_enabled')::boolean AS ai_recommendations_enabled
         FROM users
         WHERE id = $1`,
        [userId],
      );

      const locale = userRows[0]?.locale ?? 'en';
      const aiEnabled = userRows[0]?.ai_recommendations_enabled ?? true;

      const recentLogRows = await em.query<
        Array<{ logDate: string; status: 'completed' | 'skipped' }>
      >(
        `SELECT log_date::text AS "logDate", status
         FROM habit_logs
         WHERE habit_id = $1 AND user_id = $2
           AND log_date >= CURRENT_DATE - 7
         ORDER BY log_date DESC`,
        [habitId, userId],
      );

      const ctx: RuleContext = {
        userId,
        habitId,
        habitConfig: {
          difficulty: habitRows[0].difficulty,
          preferredTime: habitRows[0].preferred_time,
          frequencyType: habitRows[0].frequency_type,
        },
        habitAnalytics: analytics,
        recentLogs: recentLogRows,
      };

      const results = this.ruleEngine.evaluate(ctx);

      for (const result of results) {
        const onCooldown = await this.recommendationRepo.hasCooldownActive(
          userId,
          habitId,
          result.category,
          em,
        );
        if (onCooldown) continue;

        const insertData = await this.resolveInsertData(
          result,
          analytics,
          habitRows[0].name,
          habitRows[0].difficulty,
          habitRows[0].preferred_time,
          locale,
          userId,
          aiEnabled,
        );

        await this.recommendationRepo.insert(
          {
            userId,
            habitId,
            category: result.category,
            title: result.title,
            body: insertData.body,
            priority: result.priority,
            actionPayload: result.actionPayload ?? null,
            source: insertData.source,
            experimentVariant,
            llmModel: insertData.llmModel,
            llmTokensInput: insertData.llmTokensInput,
            llmTokensOutput: insertData.llmTokensOutput,
            llmCostCents: insertData.llmCostCents,
          },
          em,
        );
        inserted = true;
        this.metrics.recommendationsGeneratedTotal.inc({ source: insertData.source });
        if (insertData.llmCostCents) this.metrics.addLlmCost(insertData.llmCostCents);
      }
    });

    if (inserted) {
      await this.cacheService.del(CacheKeys.dashboard(userId));
    }
  }

  // ─── LLM augmentation flow (§6.3.1) ─────────────────────────────────────────

  private async resolveInsertData(
    result: RuleResult,
    analytics: HabitAnalytics,
    habitName: string,
    difficulty: number,
    preferredTime: string | null,
    locale: string,
    userId: string,
    aiEnabled: boolean,
  ): Promise<{
    body: string;
    source: 'rule' | 'ai';
    llmModel?: string;
    llmTokensInput?: number;
    llmTokensOutput?: number;
    llmCostCents?: number;
  }> {
    const template = { body: result.body, source: 'rule' as const };

    // §6.3.1 — gate 1: user opt-out
    if (!aiEnabled) return template;

    // §6.3.1 — gate 2: circuit breaker
    if (await this.llmCost.isCircuitOpen()) {
      this.logger.debug('LLM circuit open — using template');
      return template;
    }

    // §6.3.1 — gate 3: per-user daily quota
    if (await this.llmCost.isUserQuotaExceeded(userId, MAX_AI_RECS_PER_USER_PER_DAY)) {
      this.logger.debug(`User ${userId} AI quota exceeded — using template`);
      return template;
    }

    // §6.3.1 — gate 4: system-wide daily budget
    const budgetCents = this.config.get<number>('OPENAI_DAILY_BUDGET_CENTS') ?? 300;
    if (await this.llmCost.isSystemBudgetExceeded(budgetCents)) {
      this.logger.debug('System LLM budget exceeded — using template');
      return template;
    }

    // §6.3.2 — build prompt and call LLM
    const prompt = buildLlmPrompt({
      analytics,
      habitName,
      difficulty,
      preferredTime,
      locale,
      ruleCategory: result.category,
    });

    let llmResponse;
    try {
      llmResponse = await this.llmProvider.complete(prompt);
    } catch (err) {
      this.logger.warn(`LLM call failed: ${String(err)}`);
      await this.llmCost.recordError();
      return template;
    }

    // NullLlmProvider (test/no-key) returns null
    if (!llmResponse) return template;

    // §6.3.3 — safety filter
    const safeText = applySafetyFilter(llmResponse.text);
    if (!safeText) {
      this.logger.warn('LLM output failed safety filter — using template');
      return template;
    }

    // Success path — record cost and return AI recommendation
    await this.llmCost.recordSuccess(llmResponse.costCents);

    return {
      body: safeText,
      source: 'ai',
      llmModel: llmResponse.model,
      llmTokensInput: llmResponse.tokensInput,
      llmTokensOutput: llmResponse.tokensOutput,
      llmCostCents: llmResponse.costCents,
    };
  }

  // ─── Private: Redis Streams consumer loop ────────────────────────────────────

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis!.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '$', 'MKSTREAM');
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) throw err;
    }
  }

  private startPollLoop(): void {
    void this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    while (this.active) {
      if (this.running) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      this.running = true;
      try {
        await this.pollOnce();
      } catch (err) {
        this.logger.error(`Recommendations poll error: ${String(err)}`);
      } finally {
        this.running = false;
      }
    }
  }

  private async pollOnce(): Promise<void> {
    type XReadGroupResult = Array<[string, Array<[string, string[]]>]> | null;

    const results = (await this.redis!.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_ID,
      'COUNT',
      BATCH_SIZE,
      'BLOCK',
      POLL_BLOCK_MS,
      'STREAMS',
      STREAM_KEY,
      '>',
    )) as XReadGroupResult;

    if (!results) return;

    for (const [, messages] of results) {
      for (const [msgId, fields] of messages) {
        const event = parseStreamMessage(fields);
        if (!event) {
          this.logger.warn(`Could not parse stream message ${msgId}`);
          continue;
        }
        try {
          await this.handleEvent(event);
          await this.redis!.xack(STREAM_KEY, CONSUMER_GROUP, msgId);
        } catch (err) {
          this.logger.error(`Failed to process event ${event.id}: ${String(err)}`);
        }
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseStreamMessage(fields: string[]): OutboxEvent | null {
  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) {
    map[fields[i]!] = fields[i + 1]!;
  }
  if (!map['id'] || !map['user_id'] || !map['event_type']) return null;

  try {
    return {
      id: map['id'],
      userId: map['user_id'],
      eventType: map['event_type'],
      aggregateType: map['aggregate_type'] ?? '',
      aggregateId: map['aggregate_id'] || null,
      payload: JSON.parse(map['payload'] ?? '{}') as Record<string, unknown>,
      occurredAt: new Date(map['occurred_at'] ?? Date.now()),
    };
  } catch {
    return null;
  }
}
