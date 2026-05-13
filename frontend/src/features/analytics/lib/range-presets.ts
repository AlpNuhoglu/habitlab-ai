import type { DisplayRange } from '../types';
import type { UserAnalytics } from '../types';

export const DISPLAY_RANGE_LABELS: Record<DisplayRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
};

/** Maps a DisplayRange to the corresponding UserAnalytics rate field key. */
export function getRateField(range: DisplayRange): keyof Pick<
  UserAnalytics,
  'completionRate7d' | 'completionRateOverall' | 'completionRateAllTime'
> {
  switch (range) {
    case '7d':
      return 'completionRate7d';
    case '90d':
      // GlobalAnalyticsDto has no 90d rate — fall back to overall (30d proxy)
      return 'completionRateOverall';
    case 'all':
      return 'completionRateAllTime';
    case '30d':
    default:
      return 'completionRateOverall';
  }
}

/** Maps a DisplayRange to the corresponding HabitAnalyticsExt rate field key. */
export function getHabitRateField(range: DisplayRange): 'completionRate7d' | 'completionRate30d' | 'completionRate90d' | 'completionRateAllTime' {
  switch (range) {
    case '7d':
      return 'completionRate7d';
    case '90d':
      return 'completionRate90d';
    case 'all':
      return 'completionRateAllTime';
    case '30d':
    default:
      return 'completionRate30d';
  }
}
