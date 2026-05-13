import type { UserAnalytics, HabitAnalyticsExt } from '../types';

export function makeUserAnalytics(overrides?: Partial<UserAnalytics>): UserAnalytics {
  return {
    completionRateOverall: 0.72,
    completionRate7d: 0.86,
    completionRateAllTime: 0.68,
    mostConsistentHabitId: 'habit-a',
    mostStrugglingHabitId: 'habit-b',
    bestWeekday: 1,       // Tuesday
    bestHourOfDay: 8,
    totalLogs30d: 45,
    totalCompletions30d: 32,
    totalSkips30d: 13,
    recomputedAt: '2026-05-10T06:00:00.000Z',
    ...overrides,
  };
}

export function makeHabitAnalyticsExt(overrides?: Partial<HabitAnalyticsExt>): HabitAnalyticsExt {
  return {
    habitId: 'habit-a',
    currentStreak: 7,
    longestStreak: 21,
    completionRate7d: 0.86,
    completionRate30d: 0.72,
    completionRate90d: 0.65,
    completionRateAllTime: 0.68,
    completionByWeekday: [5, 6, 4, 3, 2, 1, 0],  // Mon=0 has count 5
    completionByHour: Array.from<number>({ length: 24 }).fill(0).map((_, i) => (i === 8 ? 12 : 0)),
    monthlyTrend: [
      { month: '2026-01', rate: 0.65 },
      { month: '2026-02', rate: 0.70 },
      { month: '2026-03', rate: 0.75 },
      { month: '2026-04', rate: 0.72 },
    ],
    lastCompletedAt: '2026-05-10T08:05:00.000Z',
    lastSkippedAt: null,
    ...overrides,
  };
}
