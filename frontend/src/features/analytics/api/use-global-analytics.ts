import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { analyticsKeys } from '../../../api/query-keys';
import type { UserAnalytics } from '../types';

export function useGlobalAnalytics() {
  return useQuery<UserAnalytics>({
    queryKey: analyticsKeys.global(),
    queryFn: () => apiFetch<UserAnalytics>('/api/v1/analytics'),
    staleTime: 600_000,       // 10 min — mirrors backend Redis TTL 600s
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
