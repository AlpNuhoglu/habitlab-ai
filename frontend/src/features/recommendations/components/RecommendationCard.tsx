import { useAcceptRecommendation } from '../api/use-accept-recommendation';
import { useDismissRecommendation } from '../api/use-dismiss-recommendation';
import type { DashboardRecommendation } from '../../habits/types';

interface RecommendationCardProps {
  readonly recommendation: DashboardRecommendation;
}

const CATEGORY_ICONS: Record<string, string> = {
  reschedule: '⏰',
  reduce_difficulty: '📉',
  streak_celebration: '🔥',
  encouragement_after_skip: '💪',
  consistency_reinforcement: '⭐',
  retroactive_logging_reminder: '📝',
};

export function RecommendationCard({ recommendation: rec }: RecommendationCardProps): React.ReactElement {
  const accept = useAcceptRecommendation();
  const dismiss = useDismissRecommendation();

  const icon = CATEGORY_ICONS[rec.category] ?? '💡';
  const isPending = accept.isPending || dismiss.isPending;

  return (
    <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
      <span className="mt-0.5 text-xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-indigo-900">{rec.title}</p>
        <p className="mt-0.5 text-xs text-indigo-700">{rec.body}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              accept.mutate({ recommendationId: rec.id, habitId: rec.habitId ?? '' })
            }
            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => dismiss.mutate(rec.id)}
            className="rounded-md border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
