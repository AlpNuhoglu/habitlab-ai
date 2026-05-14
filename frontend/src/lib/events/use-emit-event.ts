import { useCallback } from 'react';

import type { ClientEvent } from './client-event';
import { enqueue } from './event-sink';

// Fire-and-forget: component unmount does not drop buffered events.
// The buffer outlives the component — EventSinkProvider owns the flush lifecycle.
export function useEmitEvent(): (event: ClientEvent) => void {
  return useCallback((event: ClientEvent) => enqueue(event), []);
}

// Re-exported so features/ can import emit helpers without touching client-event directly.
export {
  emitRecommendationShown,
  emitRecommendationAccepted,
  emitRecommendationDismissed,
  emitRecommendationSuspicious,
  emitImpression,
  emitExposure,
  emitClientError,
} from './client-event';
