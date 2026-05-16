import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { experimentKeys } from '../../../api/query-keys';
import type { AssignmentsMap } from '../lib/slot-registry';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';

export function useAllAssignments(): UseQueryResult<AssignmentsMap> {
  return useQuery<AssignmentsMap>({
    queryKey: experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
    queryFn: () =>
      apiFetch<AssignmentsMap>(
        `/api/v1/experiments/variant?keys=${KNOWN_EXPERIMENT_KEYS.join(',')}`,
      ),
    staleTime: 300_000,       // 5 min — assignments sticky; converges within 5 min of experiment pause
    gcTime: 86_400_000,       // 24h
    refetchOnWindowFocus: false,
    retry: false,             // soft-fail on error; boundary renders children anyway
  });
}
