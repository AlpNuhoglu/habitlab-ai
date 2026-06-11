import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { dashboardKeys } from '../../../api/query-keys';
import { DataState } from '../../../components/DataState';
import { useRealtime } from '../../../lib/events/use-realtime';
import { useDashboard } from '../api/use-dashboard';
import { useAcceptRecommendation } from '../../recommendations/api/use-accept-recommendation';
import { useDismissRecommendation } from '../../recommendations/api/use-dismiss-recommendation';
import { RecommendationCard } from '../../recommendations/components/RecommendationCard';
import type { Recommendation } from '../../recommendations/types';
import { DashboardGreeting } from '../components/DashboardGreeting';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { DashboardSummaryTiles } from '../components/DashboardSummaryTiles';
import { TodayList } from '../components/TodayList';

export function DashboardPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { isPending, isError, data } = useDashboard();
  const accept = useAcceptRecommendation();
  const dismiss = useDismissRecommendation();

  // Stub: no-op until SSE lands. When useRealtime is wired to a real transport,
  // this invalidation fires without touching this component.
  useRealtime({
    channel: 'habits',
    onEvent: () => void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
    enabled: false,
  });

  const habitNameById = useMemo(
    () => new Map(data?.habits.map((h) => [h.id, h.name]) ?? []),
    [data?.habits],
  );

  function handleAccept(rec: Recommendation) {
    accept.mutate({
      recommendation: rec,
      habitName: rec.habitId ? (habitNameById.get(rec.habitId) ?? null) : null,
    });
  }

  function handleDismiss(rec: Recommendation) {
    dismiss.mutate({
      recommendation: rec,
      habitName: rec.habitId ? (habitNameById.get(rec.habitId) ?? rec.category) : rec.category,
    });
  }

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
              <h2 className="mb-3 text-xs font-semibold tracking-widest uppercase text-gray-500">Today&apos;s habits</h2>
              <TodayList summary={summary} />
            </section>

            {summary.activeRecommendations.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold tracking-widest uppercase text-gray-500">Recommendations</h2>
                <div className="space-y-3">
                  {summary.activeRecommendations.slice(0, 3).map((r, i) => (
                    <RecommendationCard
                      key={r.id}
                      recommendation={r as unknown as Recommendation}
                      index={i}
                      onAccept={handleAccept}
                      onDismiss={handleDismiss}
                      isAccepting={accept.isPending}
                      isDismissing={dismiss.isPending}
                      compact
                    />
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
