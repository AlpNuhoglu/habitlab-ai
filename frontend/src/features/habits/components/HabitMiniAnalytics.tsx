import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { habitKeys } from '../../../api/query-keys';
import { WEEKDAY_LABELS } from '../schema/_frequency';
import type { HabitAnalytics } from '../types';

interface HabitMiniAnalyticsProps {
  readonly habitId: string;
}

export function HabitMiniAnalytics({ habitId }: HabitMiniAnalyticsProps): React.ReactElement {
  const { data, isPending } = useQuery<HabitAnalytics>({
    queryKey: habitKeys.analytics(habitId),
    queryFn: () => apiFetch<HabitAnalytics>(`/api/v1/habits/${habitId}/analytics`),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isPending) {
    return <div className="h-20 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (!data) return <></>;

  const bestDay = data.bestWeekday != null ? WEEKDAY_LABELS[data.bestWeekday] : null;
  const bestHour = data.bestHour != null ? `${String(data.bestHour).padStart(2, '0')}:00` : null;

  return (
    <div className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4">
      <Stat label="Best day" value={bestDay ?? '—'} />
      <Stat label="Best time" value={bestHour ?? '—'} />
      <Stat label="7d rate" value={`${Math.round(data.completionRate7d * 100)}%`} />
      <Stat label="All-time" value={`${Math.round(data.completionRateAllTime * 100)}%`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
