import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { chatKeys } from '../../../api/query-keys';
import type { ChatHistory } from '../types';

export function useChatHistory() {
  return useQuery<ChatHistory>({
    queryKey: chatKeys.history(),
    queryFn: () => apiFetch<ChatHistory>('/api/v1/coach/chat/history?limit=50'),
    staleTime: 0,
    retry: 1,
  });
}
