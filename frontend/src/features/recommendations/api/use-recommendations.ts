import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { recommendationKeys } from '../../../api/query-keys';
import type { Recommendation } from '../types';

export function useRecommendations() {
  return useQuery<Recommendation[]>({
    queryKey: recommendationKeys.active(),
    queryFn: () => apiFetch<Recommendation[]>('/api/v1/recommendations'),
    staleTime: 2 * 60_000,
    select: (data) => [...data].sort((a, b) => b.priority - a.priority),
    retry: 1,
  });
}
