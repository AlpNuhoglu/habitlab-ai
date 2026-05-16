import { useEffect } from 'react';

import { emitClientExposure } from '../../../lib/events/use-emit-event';
import { hasSeenExposure, markExposureSeen } from '../lib/exposure-dedup';
import type { KnownExperimentKey } from '../lib/slot-registry';

// Fires experiment.client_exposure once per (experimentKey, session).
// Never fires for 'control' — control is the baseline, not a variant exposure.
export function useExposure(
  experimentKey: KnownExperimentKey,
  variantKey: string,
  feature: string,
): void {
  useEffect(() => {
    if (variantKey === 'control') return;
    if (hasSeenExposure(experimentKey)) return;
    markExposureSeen(experimentKey);
    emitClientExposure(experimentKey, variantKey, feature);
  }, [experimentKey, variantKey, feature]);
}
