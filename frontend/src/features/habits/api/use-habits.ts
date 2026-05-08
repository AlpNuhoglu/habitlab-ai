import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { habitKeys } from '../../../api/query-keys';
import type { HabitListFilters } from '../../../api/query-keys';
import type { Habit } from '../types';

export { type HabitListFilters };

interface HabitListResponse {
  data: Habit[];
  total: number;
  limit: number;
  offset: number;
}

const DEFAULT_FILTERS: HabitListFilters = { status: 'active', sort: 'created-desc' };

export function useHabits(filters: HabitListFilters = DEFAULT_FILTERS) {
  return useQuery<Habit[]>({
    queryKey: habitKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status === 'archived') params.set('include_archived', 'true');
      if (filters.status === 'all') params.set('include_archived', 'true');
      const qs = params.toString();
      const res = await apiFetch<HabitListResponse>(`/api/v1/habits${qs ? `?${qs}` : ''}`);
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
