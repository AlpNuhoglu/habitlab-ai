import { useEffect, useRef } from 'react';

import { emitClientExposure } from '../../../lib/events/use-emit-event';
import { hasSeenExposure, markExposureSeen } from '../lib/exposure-dedup';
import type { KnownExperimentKey } from '../lib/slot-registry';

// Returns a ref to attach to the slot element (viewport mode) or undefined (mount mode).
// Viewport mode: fires exposure after ≥50% visibility for ≥200ms — same semantics as
// useImpressionTracking in recommendations, but decoupled (different options shape).
// Mount mode: fires immediately via useEffect on first render.
// Never fires for 'control'.
export function useSlotImpression(
  experimentKey: KnownExperimentKey,
  variantKey: string,
  feature: string,
  exposureMode: 'mount' | 'viewport',
): React.RefObject<HTMLElement> | undefined {
  const ref = useRef<HTMLElement>(null);
  const optRef = useRef({ experimentKey, variantKey, feature });
  optRef.current = { experimentKey, variantKey, feature };

  // Mount mode
  useEffect(() => {
    if (exposureMode !== 'mount') return;
    const { experimentKey: key, variantKey: variant, feature: feat } = optRef.current;
    if (variant === 'control') return;
    if (hasSeenExposure(key)) return;
    markExposureSeen(key);
    emitClientExposure(key, variant, feat);
  }, [exposureMode]);

  // Viewport mode
  useEffect(() => {
    if (exposureMode !== 'viewport') return;
    if (variantKey === 'control') return;
    if (hasSeenExposure(experimentKey)) return;
    // Guard for test environments without IntersectionObserver
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
            const { experimentKey: key, variantKey: variant, feature: feat } = optRef.current;
            if (variant === 'control') return;
            if (hasSeenExposure(key)) return;
            markExposureSeen(key);
            emitClientExposure(key, variant, feat);
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
  }, [experimentKey, variantKey, exposureMode]);

  return exposureMode === 'viewport' ? ref : undefined;
}
