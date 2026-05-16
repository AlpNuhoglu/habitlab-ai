import { useEffect } from 'react';

import { VariantSlot } from '../../experiments/components/VariantSlot';
import { emitRecommendationSuspicious } from '../../../lib/events/use-emit-event';
import { CATEGORY_META } from '../lib/category-meta';
import { isSuspiciousPayload } from '../lib/suspicious-payload-check';
import { useImpressionTracking } from '../lib/use-impression-tracking';
import type { Recommendation } from '../types';
import { CategoryBadge } from './CategoryBadge';
import { RecommendationSourceBadge } from './RecommendationSourceBadge';

export interface RecommendationCardProps {
  readonly recommendation: Recommendation;
  readonly habitName?: string;
  readonly onAccept?: (r: Recommendation) => void;
  readonly onDismiss?: (r: Recommendation) => void;
  readonly isAccepting?: boolean;
  readonly isDismissing?: boolean;
  readonly compact?: boolean;
  readonly index?: number;
}

export function RecommendationCard({
  recommendation: rec,
  habitName,
  onAccept,
  onDismiss,
  isAccepting = false,
  isDismissing = false,
  compact = false,
  index = 0,
}: RecommendationCardProps): React.ReactElement {
  const isPending = isAccepting || isDismissing;
  const meta = CATEGORY_META[rec.category];
  const impressionRef = useImpressionTracking(rec.id, {
    category: rec.category,
    source: rec.source,
    position: index,
  });

  // Suspicious payload detection — render as-is but emit telemetry for backend observability.
  // Layout clamps (line-clamp-* + max-h-*) prevent layout breakage regardless.
  useEffect(() => {
    const check = isSuspiciousPayload(rec);
    if (check.suspicious && check.reason) {
      emitRecommendationSuspicious(rec.id, check.reason);
    }
  }, [rec]);

  return (
    <div
      ref={impressionRef}
      className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
    >
      <div className="min-w-0 flex-1 space-y-2">
        {/* Header: badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={rec.category} />
          <RecommendationSourceBadge source={rec.source} />
        </div>

        {/* Title — server-authoritative, never wrapped in VariantSlot */}
        <p
          className={`text-sm font-semibold text-gray-900 ${
            compact ? 'line-clamp-1' : 'line-clamp-2'
          }`}
        >
          {rec.title}
        </p>

        {/* Body — server-authoritative, layout-clamped against suspicious payloads */}
        {!compact && (
          <p className="line-clamp-4 max-h-24 overflow-hidden text-xs text-gray-600">
            {rec.body}
          </p>
        )}

        {compact && (
          <p className="line-clamp-2 max-h-[5rem] overflow-hidden text-xs text-gray-500">
            {rec.body}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onAccept?.(rec)}
            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <VariantSlot id="coach.action.accept">{meta.acceptLabel}</VariantSlot>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onDismiss?.(rec)}
            className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Not now
          </button>
        </div>

        {habitName && (
          <p className="text-[10px] text-gray-400">{habitName}</p>
        )}
      </div>
    </div>
  );
}
