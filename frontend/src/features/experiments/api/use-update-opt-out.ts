import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { authKeys, experimentKeys } from '../../../api/query-keys';
import { enqueue } from '../../../lib/events/event-sink';
import { toast as fireToast } from '../../../hooks/use-toast';
import type { AuthUser } from '../../auth/types';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';

interface OptOutContext {
  readonly previousUser: AuthUser | null | undefined;
}

export function useUpdateOptOut() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiException, boolean, OptOutContext>({
    mutationFn: (optedOut) =>
      apiFetch<void>('/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({ experimentsOptedOut: optedOut }),
      }),
    onMutate: async (optedOut) => {
      await queryClient.cancelQueries({ queryKey: authKeys.me() });
      const previousUser = queryClient.getQueryData<AuthUser | null>(authKeys.me());
      queryClient.setQueryData<AuthUser | null>(authKeys.me(), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          preferences: { ...prev.preferences, experiments_opted_out: optedOut },
        };
      });
      return { previousUser };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousUser !== undefined) {
        queryClient.setQueryData(authKeys.me(), context.previousUser);
      }
      fireToast("Couldn't update preference — try again", 'error');
    },
    onSuccess: (_data, optedOut) => {
      void queryClient.invalidateQueries({
        queryKey: experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
      });
      enqueue({ type: 'experiment.opt_out_toggled', optedOut });
    },
    retry: 1,
  });
}
