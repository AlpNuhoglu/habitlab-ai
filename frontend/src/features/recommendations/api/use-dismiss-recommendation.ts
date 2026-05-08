import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { dashboardKeys } from '../../../api/query-keys';

export function useDismissRecommendation() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<void, ApiException, string>({
    mutationFn: (id) =>
      apiFetch<void>(
        `/api/v1/recommendations/${id}/dismiss`,
        { method: 'POST' },
        { idempotencyKey: getOrCreateKey() },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
    },
    onSettled: clearKey,
    retry: false,
  });
}
