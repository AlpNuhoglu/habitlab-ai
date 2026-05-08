import { useQueryClient } from '@tanstack/react-query';

import { dashboardKeys } from '../../../api/query-keys';
import { DataState } from '../../../components/DataState';
import { useRealtime } from '../../../lib/events/use-realtime';
import { useDashboard } from '../api/use-dashboard';
import { DashboardGreeting } from '../components/DashboardGreeting';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { DashboardSummaryTiles } from '../components/DashboardSummaryTiles';
import { TodayList } from '../components/TodayList';
import { RecommendationCard } from '../../recommendations/components/RecommendationCard';

export function DashboardPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { isPending, isError, data } = useDashboard();

  // Stub: no-op until SSE lands. When useRealtime is wired to a real transport,
  // this invalidation fires without touching this component.
  useRealtime({
    channel: 'habits',
    onEvent: () => void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
    enabled: false,
  });

  return (
    <div className="space-y-8">
      <DashboardGreeting />

      <DataState
        isPending={isPending}
        isError={isError}
        data={data}
        skeleton={<DashboardSkeleton />}
      >
        {(summary) => (
          <>
            <DashboardSummaryTiles summary={summary} />

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Today&apos;s habits</h2>
              <TodayList summary={summary} />
            </section>

            {summary.activeRecommendations.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Recommendations</h2>
                <div className="space-y-3">
                  {summary.activeRecommendations.slice(0, 3).map((r) => (
                    <RecommendationCard key={r.id} recommendation={r} />
                  ))}
                </div>
              </section>
            )}

          </>
        )}
      </DataState>
    </div>
  );
}
