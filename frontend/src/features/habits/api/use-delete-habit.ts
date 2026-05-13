import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { analyticsKeys, habitKeys, dashboardKeys } from '../../../api/query-keys';

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<void, ApiException, string>({
    mutationFn: (id) =>
      apiFetch<void>(
        `/api/v1/habits/${id}?hard=true`,
        { method: 'DELETE' },
        { idempotencyKey: getOrCreateKey() },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: habitKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: analyticsKeys.all }),
      ]);
    },
    onSettled: clearKey,
    retry: false,
  });
}
