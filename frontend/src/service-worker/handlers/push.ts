/// <reference lib="webworker" />
import { parsePushPayload } from '../lib/payload-schema';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event) => {
  const raw: unknown = event.data?.json();
  const payload = parsePushPayload(raw);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const visible = clients.some((c) => c.visibilityState === 'visible');

        if (visible) {
          // Forward to SPA — SPA renders an in-app toast instead of an OS notification.
          clients.forEach((c) => {
            c.postMessage({ type: 'PUSH_RECEIVED', payload: payload ?? raw });
          });
          return;
        }

        if (!payload) {
          // Unknown payload version — show a safe fallback so the user knows something arrived.
          return self.registration.showNotification('HabitLab', {
            body: 'You have a new notification.',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            tag: 'habitlab-fallback',
          });
        }

        return self.registration.showNotification(payload.title, {
          body: payload.body,
          tag: payload.tag ?? payload.habitId ?? 'habitlab',
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          data: {
            url: payload.url,
            habitId: payload.habitId,
            notificationId: payload.notificationId,
          },
        });
      }),
  );
});
