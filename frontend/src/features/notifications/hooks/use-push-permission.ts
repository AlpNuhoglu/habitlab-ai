import { useCallback, useEffect, useState } from 'react';
import { onPushMessage, postPermissionChanged } from '../lib/push-channel';

export type PermissionStateTri = 'default' | 'granted' | 'denied';

function readPermission(): PermissionStateTri {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission as PermissionStateTri;
}

export function usePushPermission() {
  const [permission, setPermission] = useState<PermissionStateTri>(readPermission);

  useEffect(() => {
    // Permissions API change events (Chrome/Firefox).
    let permStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      void navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permStatus = status;
          status.onchange = () => setPermission(readPermission());
        })
        .catch(() => undefined);
    }

    // Cross-tab sync.
    const unsub = onPushMessage((msg) => {
      if (msg.type === 'PERMISSION_CHANGED') setPermission(msg.value as PermissionStateTri);
    });

    // Coarse fallback: re-read on tab focus.
    const onFocus = () => setPermission(readPermission());
    window.addEventListener('visibilitychange', onFocus);

    return () => {
      if (permStatus) permStatus.onchange = null;
      unsub();
      window.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const result = await Notification.requestPermission();
    setPermission(result as PermissionStateTri);
    postPermissionChanged(result);
    return result;
  }, []);

  return { permission, requestPermission };
}
