import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';
import { habitKeys } from '../../../api/query-keys';
import type { Habit } from '../types';

export function useHabit(id: string) {
  const navigate = useNavigate();

  return useQuery<Habit>({
    queryKey: habitKeys.detail(id),
    queryFn: async () => {
      try {
        return await apiFetch<Habit>(`/api/v1/habits/${id}`);
      } catch (err) {
        if (err instanceof ApiException && err.error.kind === 'server' && err.error.status === 404) {
          navigate('/habits', { replace: true });
        }
        throw err;
      }
    },
    staleTime: 30_000,
    retry: 1,
  });
}
