import { useQueryClient } from '@tanstack/react-query';

import { experimentKeys } from '../../../api/query-keys';
import type { AssignmentsMap, KnownExperimentKey } from '../lib/slot-registry';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';

// Pure cache read — no network call, no exposure event.
// Returns 'control' on cache miss (hydration pending, error, or opted-out).
export function useVariant(key: KnownExperimentKey): string {
  const queryClient = useQueryClient();

  // Dev-only: ?force_variant=experimentKey:variantKey overrides the cache.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('force_variant');
    if (param) {
      const [forceKey, forceVariant] = param.split(':');
      if (forceKey === key && forceVariant) return forceVariant;
    }
  }

  const data = queryClient.getQueryData<AssignmentsMap>(
    experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
  );
  return data?.[key] ?? 'control';
}
