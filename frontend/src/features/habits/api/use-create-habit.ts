import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { analyticsKeys, habitKeys, dashboardKeys } from '../../../api/query-keys';
import type { CreateHabitPayload } from '../lib/habit-form-mapper';
import type { Habit } from '../types';

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<Habit, ApiException, CreateHabitPayload>({
    mutationFn: (dto) =>
      apiFetch<Habit>(
        '/api/v1/habits',
        { method: 'POST', body: JSON.stringify(dto) },
        { idempotencyKey: getOrCreateKey() },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: analyticsKeys.global() }),
      ]);
    },
    onSettled: clearKey,
    retry: false,
  });
}
