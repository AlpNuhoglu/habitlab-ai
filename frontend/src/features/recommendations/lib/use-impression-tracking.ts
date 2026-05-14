import { useEffect, useRef } from 'react';

import { emitRecommendationShown } from '../../../lib/events/use-emit-event';
import type { RecommendationCategory, RecommendationSource } from '../types';

// Module-level Set dedupes impressions across the session without React state.
// Resets only on full page unload (navigation inside the SPA does not reset it —
// that is intentional: we count once per session, not once per route visit).
const _seen = new Set<string>();

interface ImpressionOptions {
  readonly category: RecommendationCategory;
  readonly source: RecommendationSource;
  readonly position: number;
}

export function useImpressionTracking(
  recId: string,
  options: ImpressionOptions,
): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  // Stable refs for options so the effect doesn't re-run on every render
  const optRef = useRef(options);
  optRef.current = options;

  useEffect(() => {
    if (_seen.has(recId)) return;
    // Guard for test environments that don't implement IntersectionObserver
    if (typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= 0.5) {
          timer = setTimeout(() => {
            if (document.visibilityState === 'hidden') return;
            if (_seen.has(recId)) return;
            _seen.add(recId);
            const { category, source, position } = optRef.current;
            emitRecommendationShown(recId, category, source, position);
          }, 200);
        } else {
          if (timer !== null) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, [recId]);

  return ref;
}

// Exposed for tests only — resets the seen set between test cases.
export function _resetSeenForTesting(): void {
  _seen.clear();
}
