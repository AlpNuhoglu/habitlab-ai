import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { habitKeys, dashboardKeys } from '../../../api/query-keys';
import type { UpdateHabitPayload } from '../lib/habit-form-mapper';
import type { Habit } from '../types';

interface UpdateHabitVars {
  id: string;
  dto: UpdateHabitPayload;
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<Habit, ApiException, UpdateHabitVars>({
    mutationFn: ({ id, dto }) =>
      apiFetch<Habit>(
        `/api/v1/habits/${id}`,
        { method: 'PATCH', body: JSON.stringify(dto) },
        { idempotencyKey: getOrCreateKey() },
      ),
    onSuccess: async (_data, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: habitKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
      ]);
    },
    onSettled: clearKey,
    retry: false,
  });
}
