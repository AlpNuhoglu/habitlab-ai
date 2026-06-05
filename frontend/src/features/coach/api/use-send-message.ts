import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { chatKeys } from '../../../api/query-keys';
import type { ChatHistory, ChatMessage } from '../types';

interface SendMessageVars {
  message: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, SendMessageVars>({
    mutationFn: ({ message }) =>
      apiFetch<ChatMessage>('/api/v1/coach/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),

    onMutate: async ({ message }) => {
      // Optimistically add the user's message so the UI responds instantly
      await queryClient.cancelQueries({ queryKey: chatKeys.history() });

      const optimisticUserMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatHistory>(chatKeys.history(), (prev) => {
        const messages = prev?.messages ?? [];
        return { messages: [...messages, optimisticUserMsg], hasMore: prev?.hasMore ?? false };
      });

      return { optimisticUserMsg };
    },

    onSuccess: () => {
      // Invalidate so history is refetched from the server, which now has both
      // the real user message (with its DB uuid) and the assistant reply.
      // The optimistic message stays visible until the refetch replaces the cache.
      void queryClient.invalidateQueries({ queryKey: chatKeys.history() });
    },

    onError: () => {
      // Roll back by invalidating — next refetch restores server truth
      void queryClient.invalidateQueries({ queryKey: chatKeys.history() });
    },
  });
}
