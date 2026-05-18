import { apiFetch } from '../../../api/client';
import { clearSubscription, getSubscription, saveSubscription } from './subscription-store';
import type { PushSubscriptionRecord, PushSubscriptionPayload } from '../api/use-subscribe';

export async function reconcileLocalSubscription(_userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch {
    return;
  }

  const [idbEntry, browserSub] = await Promise.all([
    getSubscription(),
    reg.pushManager.getSubscription().catch(() => null),
  ]);

  // No local state at all — nothing to reconcile.
  if (!idbEntry && !browserSub) return;

  // Browser has no subscription but IDB thinks it does → clear IDB, delete from backend.
  if (idbEntry && !browserSub) {
    await clearSubscription();
    await apiFetch<void>(`/api/v1/notifications/subscriptions/${idbEntry.id}`, { method: 'DELETE' }).catch(() => undefined);
    return;
  }

  if (!browserSub) return;

  const subJson = browserSub.toJSON();
  const keys = subJson.keys as { p256dh: string; auth: string } | undefined;
  const payload: PushSubscriptionPayload = {
    endpoint: browserSub.endpoint,
    expirationTime: browserSub.expirationTime,
    keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
    userAgent: navigator.userAgent,
  };

  // Browser has subscription but IDB has nothing → POST to backend, save to IDB.
  if (!idbEntry) {
    try {
      const record = await apiFetch<PushSubscriptionRecord>('/api/v1/notifications/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await saveSubscription({ id: record.id, endpoint: browserSub.endpoint, expirationTime: browserSub.expirationTime });
    } catch {
      // Non-fatal — will retry on next boot.
    }
    return;
  }

  // Endpoints diverged (browser rotated subscription) → re-POST, update IDB.
  if (idbEntry.endpoint !== browserSub.endpoint) {
    try {
      await apiFetch<void>(`/api/v1/notifications/subscriptions/${idbEntry.id}`, { method: 'DELETE' }).catch(() => undefined);
      const record = await apiFetch<PushSubscriptionRecord>('/api/v1/notifications/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await saveSubscription({ id: record.id, endpoint: browserSub.endpoint, expirationTime: browserSub.expirationTime });
    } catch {
      // Non-fatal.
    }
  }
}
