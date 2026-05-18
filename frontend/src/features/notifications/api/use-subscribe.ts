import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiException } from '../../../api/client';
import { notificationKeys } from '../../../api/query-keys';
import { saveSubscription } from '../lib/subscription-store';

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
  userAgent: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  createdAt: string;
  userAgent: string | null;
}

export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation<PushSubscriptionRecord, ApiException, PushSubscriptionPayload>({
    mutationFn: (body) =>
      apiFetch<PushSubscriptionRecord>('/api/v1/notifications/subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async (data, variables) => {
      await saveSubscription({
        id: data.id,
        endpoint: variables.endpoint,
        expirationTime: variables.expirationTime,
      });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.subscriptions() });
    },
    retry: false,
  });
}
