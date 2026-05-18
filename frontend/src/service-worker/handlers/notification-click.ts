/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

interface NotificationData {
  url?: string;
  habitId?: string;
  notificationId?: string;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data as NotificationData | null;
  const deepLink =
    data?.url ??
    (data?.habitId ? `/habits/${data.habitId}` : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        void existing.focus();
        void existing.navigate(deepLink);
      } else {
        void self.clients.openWindow(deepLink);
      }

      // Fire-and-forget delivery telemetry.
      void fetch('/api/v1/events/client', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{
            clientEventId: crypto.randomUUID(),
            occurredAt: new Date().toISOString(),
            event: {
              type: 'push.opened',
              notificationId: data?.notificationId,
              habitId: data?.habitId,
            },
          }],
        }),
      }).catch(() => undefined);
    }),
  );
});
