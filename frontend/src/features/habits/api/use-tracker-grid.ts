import { useQueries } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { habitKeys } from '../../../api/query-keys';
import { useHabits } from './use-habits';
import type { CalendarDay, Habit } from '../types';

export interface TrackerRow {
  habit: Habit;
  days: CalendarDay[];
  isLoading: boolean;
}

export function useTrackerGrid(from: string, to: string): {
  rows: TrackerRow[];
  isLoading: boolean;
} {
  const habitsQuery = useHabits({ status: 'active', sort: 'created-desc' });
  const habits = habitsQuery.data ?? [];

  const calendarQueries = useQueries({
    queries: habits.map((habit) => ({
      queryKey: habitKeys.calendar(habit.id, from, to),
      queryFn: () =>
        apiFetch<CalendarDay[]>(`/api/v1/habits/${habit.id}/calendar?from=${from}&to=${to}`),
      staleTime: 5 * 60_000,
      retry: 1,
      enabled: habits.length > 0 && !!from && !!to,
    })),
  });

  const rows: TrackerRow[] = habits.map((habit, i) => ({
    habit,
    days: calendarQueries[i]?.data ?? [],
    isLoading: calendarQueries[i]?.isPending ?? true,
  }));

  const isLoading = habitsQuery.isPending || calendarQueries.some((q) => q.isPending);

  return { rows, isLoading };
}
