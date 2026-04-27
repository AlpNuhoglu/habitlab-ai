import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { CACHE_SERVICE, ICacheService } from '../../infrastructure/cache/cache.interface';

export interface HabitAnalyticsDto {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  completionRate7d: number;
  completionRate30d: number;
  completionRate90d: number;
  completionRateAllTime: number;
  completionByWeekday: number[];
  completionByHour: number[];
  monthlyTrend: Array<{ month: string; rate: number }>;
  lastCompletedAt: string | null;
  lastSkippedAt: string | null;
}

export interface CalendarEntryDto {
  date: string;
  status: 'completed' | 'skipped';
}

export interface GlobalAnalyticsDto {
  completionRateOverall: number;
  completionRate7d: number;
  completionRateAllTime: number;
  mostConsistentHabitId: string | null;
  mostStrugglingHabitId: string | null;
  bestWeekday: number | null;
  bestHourOfDay: number | null;
  totalLogs30d: number;
  totalCompletions30d: number;
  totalSkips30d: number;
  recomputedAt: string | null;
}

const HABIT_ANALYTICS_TTL = 600;
const GLOBAL_ANALYTICS_TTL = 600;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {}

  async getHabitAnalytics(userId: string, habitId: string): Promise<HabitAnalyticsDto> {
    const cacheKey = CacheKeys.analyticsHabit(userId, habitId);
    const cached = await this.cacheService.get<HabitAnalyticsDto>(cacheKey);
    if (cached !== null) return cached;

    const rows = await this.dataSource.query<
      Array<{
        habit_id: string;
        current_streak: number;
        longest_streak: number;
        completion_rate_7d: string;
        completion_rate_30d: string;
        completion_rate_90d: string;
        completion_by_weekday: number[];
        completion_by_hour: number[];
        last_completed_at: Date | null;
        last_skipped_at: Date | null;
      }>
    >(
      `SELECT ha.*
       FROM habit_analytics ha
       JOIN habits h ON ha.habit_id = h.id
       WHERE ha.habit_id = $1 AND ha.user_id = $2 AND h.archived_at IS NULL`,
      [habitId, userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Analytics not yet computed for habit ${habitId}`);
    }
    const row = rows[0]!;

    // completion_rate_all_time — computed on demand (not stored in habit_analytics DDL)
    const allTimeRow = await this.dataSource.query<Array<{ rate: string; days_alive: string }>>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')::float
           / NULLIF(GREATEST(CURRENT_DATE - h.created_at::date + 1, 1), 0) AS rate,
         GREATEST(CURRENT_DATE - h.created_at::date + 1, 1) AS days_alive
       FROM habits h
       LEFT JOIN habit_logs hl ON hl.habit_id = h.id
       WHERE h.id = $1 AND h.user_id = $2
       GROUP BY h.created_at`,
      [habitId, userId],
    );
    const allTimeRate = Math.min(parseFloat(allTimeRow[0]?.rate ?? '0'), 1);

    // monthly_trend — last 12 full months computed from habit_logs
    const trendRows = await this.dataSource.query<
      Array<{ month: string; completions: string; days_in_month: string }>
    >(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', log_date::date), 'YYYY-MM') AS month,
         COUNT(*) FILTER (WHERE status = 'completed')::int        AS completions,
         EXTRACT(DAY FROM
           DATE_TRUNC('month', log_date::date) + INTERVAL '1 month'
           - DATE_TRUNC('month', log_date::date)
         )::int AS days_in_month
       FROM habit_logs
       WHERE habit_id = $1 AND user_id = $2
         AND log_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
       GROUP BY DATE_TRUNC('month', log_date::date)
       ORDER BY month`,
      [habitId, userId],
    );
    const monthlyTrend = trendRows.map((r) => ({
      month: r.month,
      rate: Math.min(Math.round((parseInt(r.completions, 10) / parseInt(r.days_in_month, 10)) * 1000) / 1000, 1),
    }));

    const dto: HabitAnalyticsDto = {
      habitId: row.habit_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      completionRate7d: parseFloat(row.completion_rate_7d),
      completionRate30d: parseFloat(row.completion_rate_30d),
      completionRate90d: parseFloat(row.completion_rate_90d),
      completionRateAllTime: allTimeRate,
      completionByWeekday: row.completion_by_weekday,
      completionByHour: row.completion_by_hour,
      monthlyTrend,
      lastCompletedAt: row.last_completed_at ? row.last_completed_at.toISOString() : null,
      lastSkippedAt: row.last_skipped_at ? row.last_skipped_at.toISOString() : null,
    };

    await this.cacheService.set(cacheKey, dto, HABIT_ANALYTICS_TTL);
    return dto;
  }

  async getCalendar(
    userId: string,
    habitId: string,
    from: string,
    to: string,
  ): Promise<CalendarEntryDto[]> {
    // Ownership check
    const habitRows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM habits WHERE id = $1 AND user_id = $2`,
      [habitId, userId],
    );
    if (habitRows.length === 0) throw new NotFoundException(`Habit ${habitId} not found`);

    const rows = await this.dataSource.query<Array<{ log_date: string; status: string }>>(
      `SELECT log_date::text, status
       FROM habit_logs
       WHERE habit_id = $1 AND user_id = $2
         AND log_date >= $3 AND log_date <= $4
       ORDER BY log_date`,
      [habitId, userId, from, to],
    );

    return rows.map((r) => ({
      date: r.log_date,
      status: r.status as 'completed' | 'skipped',
    }));
  }

  async getGlobalAnalytics(userId: string): Promise<GlobalAnalyticsDto> {
    const cacheKey = CacheKeys.analyticsGlobal(userId);
    const cached = await this.cacheService.get<GlobalAnalyticsDto>(cacheKey);
    if (cached !== null) return cached;

    const uaRows = await this.dataSource.query<
      Array<{
        completion_rate_7d: string;
        completion_rate_30d: string;
        completion_rate_all_time: string;
        best_weekday: number | null;
        best_hour_of_day: number | null;
        total_logs_30d: number;
        total_completions_30d: number;
        total_skips_30d: number;
        recomputed_at: Date | null;
      }>
    >(
      `SELECT
         completion_rate_7d, completion_rate_30d, completion_rate_all_time,
         best_weekday, best_hour_of_day,
         total_logs_30d, total_completions_30d, total_skips_30d,
         recomputed_at
       FROM user_analytics
       WHERE user_id = $1`,
      [userId],
    );

    const ua = uaRows[0];

    // Most consistent — highest completion_rate_30d (active habits only)
    const consistentRows = await this.dataSource.query<Array<{ habit_id: string }>>(
      `SELECT ha.habit_id
       FROM habit_analytics ha
       JOIN habits h ON ha.habit_id = h.id
       WHERE ha.user_id = $1 AND h.archived_at IS NULL
       ORDER BY ha.completion_rate_30d DESC
       LIMIT 1`,
      [userId],
    );

    // Most struggling — lowest completion_rate_30d with at least 14 logs (FR-043)
    const strugglingRows = await this.dataSource.query<Array<{ habit_id: string }>>(
      `SELECT ha.habit_id
       FROM habit_analytics ha
       JOIN habits h ON ha.habit_id = h.id
       WHERE ha.user_id = $1 AND h.archived_at IS NULL
         AND (
           SELECT COUNT(*) FROM habit_logs hl
           WHERE hl.habit_id = ha.habit_id
         ) >= 14
       ORDER BY ha.completion_rate_30d ASC
       LIMIT 1`,
      [userId],
    );

    const dto: GlobalAnalyticsDto = {
      completionRateOverall: parseFloat(ua?.completion_rate_30d ?? '0'),
      completionRate7d: parseFloat(ua?.completion_rate_7d ?? '0'),
      completionRateAllTime: parseFloat(ua?.completion_rate_all_time ?? '0'),
      mostConsistentHabitId: consistentRows[0]?.habit_id ?? null,
      mostStrugglingHabitId: strugglingRows[0]?.habit_id ?? null,
      bestWeekday: ua?.best_weekday ?? null,
      bestHourOfDay: ua?.best_hour_of_day ?? null,
      totalLogs30d: ua?.total_logs_30d ?? 0,
      totalCompletions30d: ua?.total_completions_30d ?? 0,
      totalSkips30d: ua?.total_skips_30d ?? 0,
      recomputedAt: ua?.recomputed_at ? ua.recomputed_at.toISOString() : null,
    };

    await this.cacheService.set(cacheKey, dto, GLOBAL_ANALYTICS_TTL);
    return dto;
  }
}
