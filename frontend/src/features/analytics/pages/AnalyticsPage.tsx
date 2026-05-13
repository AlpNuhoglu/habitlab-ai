import { useMemo } from 'react';

import { PageHeader } from '../../../components/PageHeader';
import { useCurrentUser } from '../../auth/api/use-current-user';
import { useHabits } from '../../habits/api/use-habits';
import { formatRate } from '../../habits/lib/streak';
import { weekdayLabel } from '../lib/format-axis';
import { hourLabel } from '../lib/format-axis';
import { getRateField, DISPLAY_RANGE_LABELS } from '../lib/range-presets';
import { hasEnoughData } from '../lib/empty-detection';
import { useDateRangeFromUrl } from '../lib/use-date-range-from-url';
import { useGlobalAnalytics } from '../api/use-global-analytics';
import { ChartFrame } from '../components/charts/ChartFrame';
import { TopHabitsChart } from '../components/charts/TopHabitsChart';
import { KpiTile } from '../components/kpi/KpiTile';
import { KpiTileGrid } from '../components/kpi/KpiTileGrid';
import { DateRangePicker } from '../components/filters/DateRangePicker';
import { AnalyticsEmptyState } from '../components/empty/AnalyticsEmptyState';
import type { TopHabitRow } from '../types';

const RATE_HINT = 'Based on the last 30 days regardless of when this habit was created.';

export function AnalyticsPage(): React.ReactElement {
  const globalQuery = useGlobalAnalytics();
  const habitsQuery = useHabits({ status: 'active', sort: 'streak-desc' });
  const { display, setDisplay } = useDateRangeFromUrl();
  const { user } = useCurrentUser();

  const locale = user?.locale ?? 'en';
  const analytics = globalQuery.data;

  const topHabits = useMemo<TopHabitRow[]>(() => {
    if (!habitsQuery.data) return [];
    return [...habitsQuery.data]
      .sort((a, b) => b.completionRate30d - a.completionRate30d)
      .slice(0, 5)
      .map((h) => ({ habitId: h.id, name: h.name, rate30d: h.completionRate30d }));
  }, [habitsQuery.data]);

  const topHabitsAccessible = useMemo<ReadonlyArray<readonly [string, string]>>(
    () => topHabits.map((h) => [h.name, formatRate(h.rate30d)] as const),
    [topHabits],
  );

  if (!globalQuery.isPending && !globalQuery.isError && !hasEnoughData(analytics ?? null)) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <AnalyticsEmptyState />
      </div>
    );
  }

  const rateField = getRateField(display);
  const rateValue = analytics ? formatRate(analytics[rateField]) : '—';

  const bestDayLabel =
    analytics?.bestWeekday != null
      ? weekdayLabel(analytics.bestWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6, locale)
      : '—';

  const bestTimeLabel =
    analytics?.bestHourOfDay != null
      ? hourLabel(analytics.bestHourOfDay, locale, '24h')
      : '—';

  const totalLogs = analytics?.totalLogs30d ?? 0;

  const showRateHint = display === '30d';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Analytics" />
        <DateRangePicker value={display} onChange={setDisplay} />
      </div>

      <KpiTileGrid>
        <KpiTile
          label={`Completion rate (${DISPLAY_RANGE_LABELS[display]})`}
          value={rateValue}
          {...(showRateHint ? { hint: RATE_HINT } : {})}
        />
        <KpiTile label="Best weekday" value={bestDayLabel} />
        <KpiTile label="Best time" value={bestTimeLabel} />
        <KpiTile label="Logs (30d)" value={totalLogs} />
      </KpiTileGrid>

      <ChartFrame
        title="Top habits (30-day rate)"
        isPending={habitsQuery.isPending}
        isError={habitsQuery.isError}
        accessibleData={topHabitsAccessible}
      >
        <TopHabitsChart data={topHabits} />
      </ChartFrame>
    </div>
  );
}
