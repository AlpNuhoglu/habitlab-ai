import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { dashboardKeys, habitKeys } from '../../../api/query-keys';

interface AcceptVars {
  recommendationId: string;
  habitId: string;
}

export function useAcceptRecommendation() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<void, ApiException, AcceptVars>({
    mutationFn: ({ recommendationId }) =>
      apiFetch<void>(
        `/api/v1/recommendations/${recommendationId}/accept`,
        { method: 'POST' },
        { idempotencyKey: getOrCreateKey() },
      ),
    onSuccess: async (_data, { habitId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) }),
      ]);
    },
    onSettled: clearKey,
    retry: false,
  });
}
