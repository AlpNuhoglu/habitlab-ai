import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';
import { analyticsKeys } from '../../../api/query-keys';
import type { HabitAnalyticsExt } from '../types';

export function useHabitAnalytics(habitId: string) {
  const navigate = useNavigate();

  return useQuery<HabitAnalyticsExt>({
    queryKey: analyticsKeys.habit(habitId),
    queryFn: async () => {
      try {
        return await apiFetch<HabitAnalyticsExt>(`/api/v1/habits/${habitId}/analytics`);
      } catch (err) {
        if (
          err instanceof ApiException &&
          err.error.kind === 'server' &&
          err.error.status === 404
        ) {
          navigate('/analytics', { replace: true });
        }
        throw err;
      }
    },
    enabled: habitId.length > 0,
    staleTime: 600_000,       // 10 min — mirrors backend Redis TTL 600s
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
