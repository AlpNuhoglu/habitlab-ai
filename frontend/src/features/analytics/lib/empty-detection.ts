import type { UserAnalytics } from '../types';

const MIN_LOGS_THRESHOLD = 5;

/** Returns false when there is not enough data to render meaningful analytics. */
export function hasEnoughData(analytics: UserAnalytics | null | undefined): boolean {
  if (analytics === null || analytics === undefined) return false;
  return analytics.totalLogs30d >= MIN_LOGS_THRESHOLD;
}
