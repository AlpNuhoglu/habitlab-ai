import type { Recommendation } from '../types';
import { CoachEmptyState } from './CoachEmptyState';
import { RecommendationCard } from './RecommendationCard';

interface Props {
  readonly recommendations: Recommendation[];
  readonly hasHabits: boolean;
  readonly onAccept: (r: Recommendation) => void;
  readonly onDismiss: (r: Recommendation) => void;
  readonly isAccepting?: boolean;
  readonly isDismissing?: boolean;
  readonly compact?: boolean;
}

export function RecommendationFeed({
  recommendations,
  hasHabits,
  onAccept,
  onDismiss,
  isAccepting = false,
  isDismissing = false,
  compact = false,
}: Props): React.ReactElement {
  if (recommendations.length === 0) {
    return <CoachEmptyState hasHabits={hasHabits} />;
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, i) => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          index={i}
          onAccept={onAccept}
          onDismiss={onDismiss}
          isAccepting={isAccepting}
          isDismissing={isDismissing}
          compact={compact}
        />
      ))}
    </div>
  );
}
