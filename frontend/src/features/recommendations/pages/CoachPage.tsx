import { useMemo, useState } from 'react';

import { VariantSlot } from '../../experiments/components/VariantSlot';
import { DataState } from '../../../components/DataState';
import { useHabits } from '../../habits/index';
import { useRealtime } from '../../../lib/events/use-realtime';
import { useRecommendations } from '../api/use-recommendations';
import { useAcceptRecommendation } from '../api/use-accept-recommendation';
import { useDismissRecommendation } from '../api/use-dismiss-recommendation';
import { AiCoachChat } from '../../coach/components/AiCoachChat';
import { CoachEmptyState } from '../components/CoachEmptyState';
import { RecommendationFeed } from '../components/RecommendationFeed';
import type { Recommendation } from '../types';

type Tab = 'insights' | 'chat';

export function CoachPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('insights');

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
      habitName: rec.habitId ? (habitNameById.get(rec.habitId) ?? rec.category) : rec.category,
    });
  }

  const recs = recsQuery.data;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-wide">
          <VariantSlot id="coach.page.title">AI Coach</VariantSlot>
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Personalized insights and live coaching powered by your habit data
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex gap-6" aria-label="Coach tabs">
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium tracking-wide transition-colors ${
              activeTab === 'insights'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-600 hover:border-gray-700 hover:text-gray-400'
            }`}
          >
            Insights
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 text-sm font-medium tracking-wide transition-colors ${
              activeTab === 'chat'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-gray-600 hover:border-gray-700 hover:text-gray-400'
            }`}
          >
            Chat
            <span className="rounded-full border border-cyan-500/40 bg-cyan-900/20 px-1.5 py-0.5 text-xs font-semibold text-cyan-400">
              AI
            </span>
          </button>
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === 'insights' && (
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
      )}

      {activeTab === 'chat' && <AiCoachChat />}
    </div>
  );
}
