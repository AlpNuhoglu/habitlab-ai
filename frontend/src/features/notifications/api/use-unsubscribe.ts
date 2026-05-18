import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiException } from '../../../api/client';
import { notificationKeys } from '../../../api/query-keys';
import { clearSubscription, getSubscription, saveSubscription, StoredSubscription } from '../lib/subscription-store';

export function useUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiException, string, StoredSubscription | null>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/v1/notifications/subscriptions/${id}`, { method: 'DELETE' }),
    onMutate: async () => {
      const previous = await getSubscription();
      await clearSubscription();
      return previous;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.subscriptions() });
    },
    onError: async (_err, _id, context) => {
      if (context) {
        await saveSubscription(context);
      }
    },
    retry: false,
  });
}
