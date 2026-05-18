import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiException } from '../../../api/client';
import { authKeys } from '../../../api/query-keys';
import type { AuthUser } from '../../auth/types';

export interface QuietHours {
  start: string;
  end: string;
}

export function useUpdateQuietHours() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiException, QuietHours, { previous: AuthUser | null }>({
    mutationFn: (quiet_hours) =>
      apiFetch<void>('/api/v1/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ quiet_hours }),
      }),
    onMutate: async (newHours) => {
      await queryClient.cancelQueries({ queryKey: authKeys.me() });
      const previous = queryClient.getQueryData<AuthUser | null>(authKeys.me()) ?? null;
      queryClient.setQueryData<AuthUser | null>(authKeys.me(), (old) => {
        if (!old) return old;
        return {
          ...old,
          preferences: { ...old.preferences, quiet_hours: newHours },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(authKeys.me(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
    retry: false,
  });
}
