let _registration: ServiceWorkerRegistration | null = null;

export function getSwRegistration(): ServiceWorkerRegistration | null {
  return _registration;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  if (!import.meta.env['VITE_VAPID_PUBLIC_KEY']) {
    console.warn('[sw-registration] VITE_VAPID_PUBLIC_KEY is not set — SW registered but push subscribe will fail.');
  }

  if (_registration) return _registration;

  try {
    _registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return _registration;
  } catch (err) {
    console.error('[sw-registration] Failed to register service worker:', err);
    return null;
  }
}
