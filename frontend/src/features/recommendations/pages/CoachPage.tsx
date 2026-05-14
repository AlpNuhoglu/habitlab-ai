import { useMemo } from 'react';

import { VariantSlot } from '../../auth/components/VariantSlot';
import { DataState } from '../../../components/DataState';
import { useHabits } from '../../habits/index';
import { useRealtime } from '../../../lib/events/use-realtime';
import { useRecommendations } from '../api/use-recommendations';
import { useAcceptRecommendation } from '../api/use-accept-recommendation';
import { useDismissRecommendation } from '../api/use-dismiss-recommendation';
import { CoachEmptyState } from '../components/CoachEmptyState';
import { RecommendationFeed } from '../components/RecommendationFeed';
import type { Recommendation } from '../types';

export function CoachPage(): React.ReactElement {
  const recsQuery = useRecommendations();
  const habitsQuery = useHabits();
  const accept = useAcceptRecommendation();
  const dismiss = useDismissRecommendation();

  // Stub: no-op until SSE lands for recommendations channel
  useRealtime({ channel: 'recommendations', onEvent: () => undefined, enabled: false });

  const habits = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data]);
  const hasHabits = habits.length > 0;

  const habitNameById = useMemo(
    () => new Map(habits.map((h) => [h.id, h.name])),
    [habits],
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
      // Fallback to category label if habit name not found (e.g. habit was deleted)
      habitName: rec.habitId ? (habitNameById.get(rec.habitId) ?? rec.category) : rec.category,
    });
  }

  const recs = recsQuery.data;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          <VariantSlot id="coach.page.title">Smart Coach</VariantSlot>
        </h1>
        <p className="mt-1 text-sm text-gray-500">Personalized insights from your habits</p>
      </div>

      <DataState
        isPending={recsQuery.isPending}
        isError={recsQuery.isError}
        data={recs}
        empty={<CoachEmptyState hasHabits={hasHabits} />}
      >
        {(recommendations) => (
          <RecommendationFeed
            recommendations={recommendations}
            hasHabits={hasHabits}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
            isAccepting={accept.isPending}
            isDismissing={dismiss.isPending}
          />
        )}
      </DataState>
    </div>
  );
}
