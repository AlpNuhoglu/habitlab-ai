import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiException } from '../../../api/client';
import { notificationKeys } from '../../../api/query-keys';
import type { PushSubscriptionRecord } from './use-subscribe';

export function useListSubscriptions() {
  return useQuery<PushSubscriptionRecord[], ApiException>({
    queryKey: notificationKeys.subscriptions(),
    queryFn: () => apiFetch<PushSubscriptionRecord[]>('/api/v1/notifications/subscriptions'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}
