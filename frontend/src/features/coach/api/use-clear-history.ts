import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { chatKeys } from '../../../api/query-keys';
import type { ChatHistory } from '../types';

export function useClearHistory() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () =>
      apiFetch<void>('/api/v1/coach/chat/history', { method: 'DELETE' }),

    onSuccess: () => {
      // Empty the cache immediately so the UI returns to the empty state,
      // then refetch to confirm server truth.
      queryClient.setQueryData<ChatHistory>(chatKeys.history(), {
        messages: [],
        hasMore: false,
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.history() });
    },
  });
}
