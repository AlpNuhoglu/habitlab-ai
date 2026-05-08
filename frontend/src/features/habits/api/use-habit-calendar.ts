import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { habitKeys } from '../../../api/query-keys';
import type { CalendarDay } from '../types';

export function useHabitCalendar(id: string, from: string, to: string) {
  return useQuery<CalendarDay[]>({
    queryKey: habitKeys.calendar(id, from, to),
    queryFn: () =>
      apiFetch<CalendarDay[]>(
        `/api/v1/habits/${id}/calendar?from=${from}&to=${to}`,
      ),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !!id && !!from && !!to,
  });
}
