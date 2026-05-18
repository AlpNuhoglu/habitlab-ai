export interface PushCapability {
  readonly serviceWorker: boolean;
  readonly pushManager: boolean;
  readonly notifications: boolean;
  readonly isSupportedBrowser: boolean;
  readonly isIOS: boolean;
  readonly reason?: 'no-sw' | 'no-pm' | 'no-notif' | 'private-mode';
}

export function detectPushCapability(): PushCapability {
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iP(hone|od|ad)/.test(navigator.userAgent);

  if (typeof navigator === 'undefined') {
    return { serviceWorker: false, pushManager: false, notifications: false, isSupportedBrowser: false, isIOS: false, reason: 'no-sw' };
  }

  const sw = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker);
  const pm = typeof window !== 'undefined' && Boolean((window as unknown as Record<string, unknown>)['PushManager']);
  const notif = typeof window !== 'undefined' && Boolean((window as unknown as Record<string, unknown>)['Notification']);

  if (!sw) return { serviceWorker: false, pushManager: pm, notifications: notif, isSupportedBrowser: false, isIOS, reason: 'no-sw' };
  if (!pm) return { serviceWorker: true, pushManager: false, notifications: notif, isSupportedBrowser: false, isIOS, reason: 'no-pm' };
  if (!notif) return { serviceWorker: true, pushManager: true, notifications: false, isSupportedBrowser: false, isIOS, reason: 'no-notif' };

  return { serviceWorker: true, pushManager: true, notifications: true, isSupportedBrowser: true, isIOS };
}
