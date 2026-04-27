import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource, EntityManager } from 'typeorm';

import { OutboxEvent } from '../../infrastructure/broker/broker-adapter.interface';
import { REDIS_CLIENT } from '../../infrastructure/broker/redis-streams-broker.adapter';
import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { CACHE_SERVICE, ICacheService } from '../../infrastructure/cache/cache.interface';
import {
  computeCurrentStreak,
  computeLongestStreak,
  todayInTimezone,
} from '../habits/habits.service';

const CONSUMER_NAME = 'analytics-worker';
const STREAM_KEY = 'habitlab:events';
const CONSUMER_GROUP = 'habitlab-analytics';
const CONSUMER_ID = 'analytics-worker-1';
const POLL_BLOCK_MS = 2000;
const BATCH_SIZE = 10;

const HANDLED_EVENTS = new Set([
  'habit.completed',
  'habit.skipped',
  'habit.log_updated',
  'habit.log_removed',
]);

@Injectable()
export class AnalyticsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsWorkerService.name);
  private running = false;
  private active = true;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    // REDIS_CLIENT is null when InfrastructureModule is in stub mode (test / BROKER_ADAPTER=stub).
    // That null is the single source of truth for "don't start the stream consumer".
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  onModuleInit(): void {
    // REDIS_CLIENT being non-null means InfrastructureModule wired a real Redis connection.
    // In stub/test mode REDIS_CLIENT is always null — no polling needed.
    if (this.redis !== null) {
      void this.ensureConsumerGroup().then(() => this.startPollLoop());
    }
  }

  onModuleDestroy(): void {
    this.active = false;
  }

  // ─── Public: called directly in tests, and by the poll loop in production ───

  async handleEvent(event: OutboxEvent): Promise<void> {
    if (!HANDLED_EVENTS.has(event.eventType)) return;

    const habitId = event.aggregateId;
    const userId = event.userId;

    if (!habitId) {
      this.logger.warn(`${event.eventType} has no aggregateId — skipping`);
      return;
    }

    let shouldProcess = false;

    await this.dataSource.transaction(async (em) => {
      // Idempotency: INSERT ON CONFLICT DO NOTHING RETURNING tells us whether the
      // row was actually inserted. TypeORM em.query() returns result.rows (the array),
      // so an empty array means conflict (duplicate) and length=1 means inserted.
      const inserted = await em.query<Array<{ event_id: string }>>(
        `INSERT INTO processed_events (event_id, consumer_name)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [event.id, CONSUMER_NAME],
      );

      if (inserted.length === 0) {
        this.logger.debug(`Duplicate event ${event.id} — skipping`);
        return;
      }

      shouldProcess = true;
      await this.recomputeHabitAnalytics(em, habitId, userId);
      await this.recomputeUserAnalytics(em, userId);
    });

    if (shouldProcess) {
      // DEL after commit — read-through + explicit invalidate (§6.4.2)
      await Promise.all([
        this.cacheService.del(CacheKeys.dashboard(userId)),
        this.cacheService.del(CacheKeys.analyticsHabit(userId, habitId)),
        this.cacheService.del(CacheKeys.analyticsGlobal(userId)),
      ]);
    }
  }

  // ─── Private: recompute helpers ──────────────────────────────────────────────

  private async recomputeHabitAnalytics(
    em: EntityManager,
    habitId: string,
    userId: string,
  ): Promise<void> {
    const userRows = await em.query<Array<{ timezone: string }>>(
      `SELECT timezone FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    const timezone = userRows[0]?.timezone ?? 'UTC';
    const today = todayInTimezone(timezone);

    // Completed dates for streak computation — ::text cast ensures the pg driver
    // returns a plain 'YYYY-MM-DD' string instead of a JavaScript Date object.
    const dateRows = await em.query<Array<{ log_date: string }>>(
      `SELECT log_date::text FROM habit_logs
       WHERE habit_id = $1 AND status = 'completed'
       ORDER BY log_date ASC`,
      [habitId],
    );
    const completedDatesSorted = dateRows.map((r) => r.log_date);
    // TODO: weekly/custom habits should compute streak in units of satisfied weeks, not days.
    // The day-level algorithm is a WP3 carry-over. Tracked in CLAUDE.md WP5 notes.
    const currentStreak = computeCurrentStreak(completedDatesSorted, today);
    const longestStreak = computeLongestStreak(completedDatesSorted);

    // Completion rates — completed logs divided by fixed denominators
    const rateRow = await em.query<Array<{ rate_7d: string; rate_30d: string; rate_90d: string }>>(
      `SELECT
         (COUNT(*) FILTER (WHERE log_date >= CURRENT_DATE - 6)::float  / 7.0)  AS rate_7d,
         (COUNT(*) FILTER (WHERE log_date >= CURRENT_DATE - 29)::float / 30.0) AS rate_30d,
         (COUNT(*) FILTER (WHERE log_date >= CURRENT_DATE - 89)::float / 90.0) AS rate_90d
       FROM habit_logs
       WHERE habit_id = $1 AND status = 'completed'`,
      [habitId],
    );
    const { rate_7d = '0', rate_30d = '0', rate_90d = '0' } = rateRow[0] ?? {};

    // Weekday distribution — logged_at in user's timezone, Mon=0..Sun=6
    const weekdayRows = await em.query<Array<{ dow: string; cnt: string }>>(
      `SELECT
         MOD(EXTRACT(DOW FROM logged_at AT TIME ZONE $2)::int + 6, 7)::int AS dow,
         COUNT(*)::int AS cnt
       FROM habit_logs
       WHERE habit_id = $1 AND status = 'completed'
       GROUP BY dow`,
      [habitId, timezone],
    );
    const completionByWeekday: number[] = new Array(7).fill(0);
    for (const row of weekdayRows) {
      const idx = parseInt(row.dow, 10);
      if (idx >= 0 && idx < 7) completionByWeekday[idx] = parseInt(row.cnt, 10);
    }

    // Hour distribution — logged_at in user's timezone
    const hourRows = await em.query<Array<{ hr: string; cnt: string }>>(
      `SELECT
         EXTRACT(HOUR FROM logged_at AT TIME ZONE $2)::int AS hr,
         COUNT(*)::int AS cnt
       FROM habit_logs
       WHERE habit_id = $1 AND status = 'completed'
       GROUP BY hr`,
      [habitId, timezone],
    );
    const completionByHour: number[] = new Array(24).fill(0);
    for (const row of hourRows) {
      const idx = parseInt(row.hr, 10);
      if (idx >= 0 && idx < 24) completionByHour[idx] = parseInt(row.cnt, 10);
    }

    // Last timestamps
    const tsRow = await em.query<Array<{ last_completed: Date | null; last_skipped: Date | null }>>(
      `SELECT
         MAX(logged_at) FILTER (WHERE status = 'completed') AS last_completed,
         MAX(logged_at) FILTER (WHERE status = 'skipped')   AS last_skipped
       FROM habit_logs
       WHERE habit_id = $1`,
      [habitId],
    );
    const { last_completed = null, last_skipped = null } = tsRow[0] ?? {};

    await em.query(
      `INSERT INTO habit_analytics (
         habit_id, user_id,
         current_streak, longest_streak,
         completion_rate_7d, completion_rate_30d, completion_rate_90d,
         completion_by_weekday, completion_by_hour,
         last_completed_at, last_skipped_at,
         recomputed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       ON CONFLICT (habit_id) DO UPDATE SET
         user_id              = EXCLUDED.user_id,
         current_streak       = EXCLUDED.current_streak,
         longest_streak       = EXCLUDED.longest_streak,
         completion_rate_7d   = EXCLUDED.completion_rate_7d,
         completion_rate_30d  = EXCLUDED.completion_rate_30d,
         completion_rate_90d  = EXCLUDED.completion_rate_90d,
         completion_by_weekday = EXCLUDED.completion_by_weekday,
         completion_by_hour   = EXCLUDED.completion_by_hour,
         last_completed_at    = EXCLUDED.last_completed_at,
         last_skipped_at      = EXCLUDED.last_skipped_at,
         recomputed_at        = now()`,
      [
        habitId,
        userId,
        currentStreak,
        longestStreak,
        Math.min(parseFloat(rate_7d), 1),
        Math.min(parseFloat(rate_30d), 1),
        Math.min(parseFloat(rate_90d), 1),
        JSON.stringify(completionByWeekday),
        JSON.stringify(completionByHour),
        last_completed,
        last_skipped,
      ],
    );
  }

  private async recomputeUserAnalytics(em: EntityManager, userId: string): Promise<void> {
    const userRows = await em.query<Array<{ timezone: string }>>(
      `SELECT timezone FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    const timezone = userRows[0]?.timezone ?? 'UTC';

    // Cross-habit completion rates + 30d counts (active habits only)
    const rateRow = await em.query<
      Array<{
        rate_7d: string;
        rate_30d: string;
        total_logs_30d: string;
        total_completions_30d: string;
        total_skips_30d: string;
        active_count: string;
      }>
    >(
      `WITH active AS (
         SELECT id FROM habits WHERE user_id = $1 AND archived_at IS NULL
       )
       SELECT
         (COUNT(hl.*) FILTER (WHERE hl.log_date >= CURRENT_DATE - 6  AND hl.status = 'completed')::float
           / NULLIF((SELECT COUNT(*) FROM active) * 7.0,  0)) AS rate_7d,
         (COUNT(hl.*) FILTER (WHERE hl.log_date >= CURRENT_DATE - 29 AND hl.status = 'completed')::float
           / NULLIF((SELECT COUNT(*) FROM active) * 30.0, 0)) AS rate_30d,
         COUNT(hl.*) FILTER (WHERE hl.log_date >= CURRENT_DATE - 29)                        AS total_logs_30d,
         COUNT(hl.*) FILTER (WHERE hl.log_date >= CURRENT_DATE - 29 AND hl.status = 'completed') AS total_completions_30d,
         COUNT(hl.*) FILTER (WHERE hl.log_date >= CURRENT_DATE - 29 AND hl.status = 'skipped')   AS total_skips_30d,
         (SELECT COUNT(*) FROM active) AS active_count
       FROM active ah
       LEFT JOIN habit_logs hl ON hl.habit_id = ah.id AND hl.user_id = $1`,
      [userId],
    );

    // All-time completion rate: completions / sum(days each active habit has existed)
    const allTimeRow = await em.query<Array<{ rate: string }>>(
      `SELECT
         COALESCE(
           SUM(CASE WHEN hl.status = 'completed' THEN 1.0 ELSE 0 END)
             / NULLIF(SUM(GREATEST(CURRENT_DATE - h.created_at::date + 1, 1)), 0),
           0
         ) AS rate
       FROM habits h
       LEFT JOIN habit_logs hl ON hl.habit_id = h.id
       WHERE h.user_id = $1 AND h.archived_at IS NULL`,
      [userId],
    );

    // Best/worst streak from already-computed habit_analytics (active habits only)
    const streakRow = await em.query<Array<{ longest: string; current_max: string }>>(
      `SELECT
         COALESCE(MAX(ha.longest_streak), 0) AS longest,
         COALESCE(MAX(ha.current_streak), 0) AS current_max
       FROM habit_analytics ha
       JOIN habits h ON ha.habit_id = h.id
       WHERE ha.user_id = $1 AND h.archived_at IS NULL`,
      [userId],
    );

    // Best/worst weekday — logged_at in user's timezone
    const weekdayRows = await em.query<Array<{ dow: string; cnt: string }>>(
      `SELECT
         MOD(EXTRACT(DOW FROM logged_at AT TIME ZONE $2)::int + 6, 7)::int AS dow,
         COUNT(*)::int AS cnt
       FROM habit_logs
       WHERE user_id = $1 AND status = 'completed'
       GROUP BY dow
       ORDER BY cnt DESC`,
      [userId, timezone],
    );

    // Best/worst hour — logged_at in user's timezone
    const hourRows = await em.query<Array<{ hr: string; cnt: string }>>(
      `SELECT
         EXTRACT(HOUR FROM logged_at AT TIME ZONE $2)::int AS hr,
         COUNT(*)::int AS cnt
       FROM habit_logs
       WHERE user_id = $1 AND status = 'completed'
       GROUP BY hr
       ORDER BY cnt DESC`,
      [userId, timezone],
    );

    const r = rateRow[0] ?? {
      rate_7d: '0',
      rate_30d: '0',
      total_logs_30d: '0',
      total_completions_30d: '0',
      total_skips_30d: '0',
      active_count: '0',
    };
    const at = allTimeRow[0] ?? { rate: '0' };
    const s = streakRow[0] ?? { longest: '0', current_max: '0' };

    const bestWeekday = weekdayRows.length > 0 ? parseInt(weekdayRows[0]!.dow, 10) : null;
    const worstWeekday =
      weekdayRows.length > 1 ? parseInt(weekdayRows[weekdayRows.length - 1]!.dow, 10) : null;
    const bestHour = hourRows.length > 0 ? parseInt(hourRows[0]!.hr, 10) : null;
    const worstHour = hourRows.length > 1 ? parseInt(hourRows[hourRows.length - 1]!.hr, 10) : null;

    await em.query(
      `INSERT INTO user_analytics (
         user_id,
         completion_rate_7d, completion_rate_30d, completion_rate_all_time,
         longest_streak, current_longest_streak,
         best_hour_of_day, worst_hour_of_day,
         best_weekday, worst_weekday,
         total_logs_30d, total_completions_30d, total_skips_30d,
         recomputed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (user_id) DO UPDATE SET
         completion_rate_7d       = EXCLUDED.completion_rate_7d,
         completion_rate_30d      = EXCLUDED.completion_rate_30d,
         completion_rate_all_time = EXCLUDED.completion_rate_all_time,
         longest_streak           = EXCLUDED.longest_streak,
         current_longest_streak   = EXCLUDED.current_longest_streak,
         best_hour_of_day         = EXCLUDED.best_hour_of_day,
         worst_hour_of_day        = EXCLUDED.worst_hour_of_day,
         best_weekday             = EXCLUDED.best_weekday,
         worst_weekday            = EXCLUDED.worst_weekday,
         total_logs_30d           = EXCLUDED.total_logs_30d,
         total_completions_30d    = EXCLUDED.total_completions_30d,
         total_skips_30d          = EXCLUDED.total_skips_30d,
         recomputed_at            = now()`,
      [
        userId,
        Math.min(parseFloat(r.rate_7d ?? '0'), 1),
        Math.min(parseFloat(r.rate_30d ?? '0'), 1),
        Math.min(parseFloat(at.rate ?? '0'), 1),
        parseInt(s.longest, 10),
        parseInt(s.current_max, 10),
        bestHour,
        worstHour,
        bestWeekday,
        worstWeekday,
        parseInt(r.total_logs_30d ?? '0', 10),
        parseInt(r.total_completions_30d ?? '0', 10),
        parseInt(r.total_skips_30d ?? '0', 10),
      ],
    );
  }

  // ─── Private: Redis Streams consumer loop (production / local dev) ───────────

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis!.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '$', 'MKSTREAM');
    } catch (err: unknown) {
      // BUSYGROUP means group already exists — safe to ignore
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
        this.logger.error(`Analytics poll error: ${String(err)}`);
      } finally {
        this.running = false;
      }
    }
  }

  private async pollOnce(): Promise<void> {
    // XREADGROUP returns null when BLOCK timeout expires with no messages
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
          // Leave unacknowledged — will be re-delivered on next poll
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
