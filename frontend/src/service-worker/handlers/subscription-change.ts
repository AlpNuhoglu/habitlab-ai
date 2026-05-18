/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Inline IDB helper — SW context cannot import from features/.
async function getStoredSubscriptionId(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open('habitlab-push', 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('subscriptions')) { resolve(null); return; }
      const tx = db.transaction('subscriptions', 'readonly');
      const getReq = tx.objectStore('subscriptions').get('current');
      getReq.onsuccess = () => {
        const val = getReq.result as { id?: string } | undefined;
        resolve(val?.id ?? null);
      };
      getReq.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function storeSubscription(id: string, endpoint: string, expirationTime: number | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('habitlab-push', 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('subscriptions', 'readwrite');
      tx.objectStore('subscriptions').put({ id, endpoint, expirationTime }, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener('pushsubscriptionchange', (event) => {
  const e = event as Event & { oldSubscription?: PushSubscription };
  event.waitUntil(resubscribeAndSync(e));
});

async function resubscribeAndSync(_event: Event & { oldSubscription?: PushSubscription }): Promise<void> {
  const vapidKey = (self as unknown as { VITE_VAPID_PUBLIC_KEY?: string }).VITE_VAPID_PUBLIC_KEY;

  if (!vapidKey) {
    console.error('[sw] VAPID key not available for pushsubscriptionchange');
    return;
  }

  // Retrieve old backend id before re-subscribing.
  const oldId = await getStoredSubscriptionId();

  // Delete old subscription from backend.
  if (oldId) {
    await fetch(`/api/v1/notifications/subscriptions/${oldId}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => undefined);
  }

  // Re-subscribe with new VAPID key.
  const newSub = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });

  const subJson = newSub.toJSON();
  const keys = subJson.keys as { p256dh: string; auth: string } | undefined;

  // POST new subscription to backend.
  const res = await fetch('/api/v1/notifications/subscriptions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: newSub.endpoint,
      expirationTime: newSub.expirationTime,
      keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
      userAgent: '',
    }),
  });

  if (res.ok) {
    const data = await res.json() as { id: string };
    await storeSubscription(data.id, newSub.endpoint, newSub.expirationTime);
  }
}
