import { z } from 'zod';

import type { HabitColor } from '../habits/types';

// ── Backend response shapes ────────────────────────────────────────────────

/** Matches GlobalAnalyticsDto from backend analytics.service.ts exactly. */
export interface UserAnalytics {
  readonly completionRateOverall: number;   // 30-day proxy
  readonly completionRate7d: number;
  readonly completionRateAllTime: number;
  readonly mostConsistentHabitId: string | null;
  readonly mostStrugglingHabitId: string | null;
  readonly bestWeekday: number | null;      // Mon=0..Sun=6
  readonly bestHourOfDay: number | null;    // 0..23, user-local timezone
  readonly totalLogs30d: number;
  readonly totalCompletions30d: number;
  readonly totalSkips30d: number;
  readonly recomputedAt: string | null;
}

/** Matches HabitAnalyticsDto from backend analytics.service.ts exactly.
 *  Note: bestHour and bestWeekday come from the existing HabitAnalytics type
 *  in features/habits/types.ts (hand-written); this extends it with the additional
 *  fields the backend actually returns. */
export interface HabitAnalyticsExt {
  readonly habitId: string;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly completionRate7d: number;
  readonly completionRate30d: number;
  readonly completionRate90d: number;
  readonly completionRateAllTime: number;
  readonly completionByWeekday: readonly number[];  // length 7, Mon=0..Sun=6
  readonly completionByHour: readonly number[];     // length 24, user-local tz
  readonly monthlyTrend: ReadonlyArray<{ readonly month: string; readonly rate: number }>;
  readonly lastCompletedAt: string | null;
  readonly lastSkippedAt: string | null;
}

// ── UI-layer contracts ─────────────────────────────────────────────────────

export type DisplayRange = '7d' | '30d' | '90d' | 'all';

export interface KpiTileModel {
  readonly label: string;
  readonly value: string | number;
  readonly delta?: {
    readonly value: number;
    readonly direction: 'up' | 'down' | 'flat';
    readonly polarity: 'positive' | 'negative';
  };
  readonly hint?: string;
}

// ── Per-chart data contracts ───────────────────────────────────────────────

export interface CompletionTrendPoint {
  readonly month: string;    // YYYY-MM
  readonly rate: number;     // 0..1
}

export interface WeekdayBucket {
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // Mon=0..Sun=6
  readonly count: number;
}

export interface HourBucket {
  readonly hour: number;     // 0..23, user-local
  readonly count: number;
}

export interface TopHabitRow {
  readonly habitId: string;
  readonly name: string;
  readonly color?: HabitColor;
  readonly rate30d: number;
}

export interface ChartFrameProps {
  readonly title: string;
  readonly description?: string;
  readonly isPending: boolean;
  readonly isError: boolean;
  /** Screen-reader-only table rows: [label, value] pairs. Non-optional — every chart must have a11y fallback. */
  readonly accessibleData: ReadonlyArray<readonly [string, string]>;
  readonly children: React.ReactNode;
}

export interface DateRangePickerProps {
  readonly value: DisplayRange;
  readonly onChange: (next: DisplayRange) => void;
}

// ── URL state schema ───────────────────────────────────────────────────────

export const AnalyticsSearchParamsSchema = z.object({
  display: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export type AnalyticsSearchParams = z.infer<typeof AnalyticsSearchParamsSchema>;
