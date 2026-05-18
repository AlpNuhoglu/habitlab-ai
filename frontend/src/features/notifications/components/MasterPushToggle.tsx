import { useState } from 'react';
import { useSubscribe } from '../api/use-subscribe';
import { useUnsubscribe } from '../api/use-unsubscribe';
import { usePushPermission } from '../hooks/use-push-permission';
import { useCurrentSubscription } from '../hooks/use-current-subscription';
import { ensureServiceWorker } from '../lib/sw-registration';
import { subscribeToPush } from '../lib/push-subscribe';
import { postSubscriptionChanged } from '../lib/push-channel';
import { PermissionPrimer } from './PermissionPrimer';

export function MasterPushToggle(): React.ReactElement {
  const { permission, requestPermission } = usePushPermission();
  const { backendId, endpoint } = useCurrentSubscription();
  const subscribe = useSubscribe();
  const unsubscribe = useUnsubscribe();
  const [showPrimer, setShowPrimer] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOn = permission === 'granted' && Boolean(backendId);

  async function turnOn(): Promise<void> {
    setError(null);
    setIsWorking(true);
    try {
      const granted = await requestPermission();
      if (granted !== 'granted') return;

      const reg = await ensureServiceWorker();
      if (!reg) throw new Error('Service worker registration failed.');

      const sub = await subscribeToPush(reg);
      const subJson = sub.toJSON();
      const keys = subJson.keys as { p256dh: string; auth: string } | undefined;

      await subscribe.mutateAsync({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
        userAgent: navigator.userAgent,
      });

      postSubscriptionChanged('added');
      setShowPrimer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
    } finally {
      setIsWorking(false);
    }
  }

  async function turnOff(): Promise<void> {
    if (!backendId) return;
    setError(null);
    setIsWorking(true);
    try {
      // Unsubscribe browser-side.
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        if (sub) await sub.unsubscribe().catch(() => undefined);
      }

      await unsubscribe.mutateAsync(backendId);
      postSubscriptionChanged('removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications.');
    } finally {
      setIsWorking(false);
    }
  }

  if (permission === 'denied') {
    return (
      <div className="text-sm text-gray-500">
        Notifications are blocked. Open browser settings to allow them for this site.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showPrimer && !isOn && (
        <PermissionPrimer
          onEnable={() => { void turnOn(); }}
          onDismiss={() => setShowPrimer(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Push notifications</p>
          <p className="text-xs text-gray-500">
            {isOn
              ? `Active on this device (${endpoint ? endpoint.slice(0, 40) + '…' : 'registered'})`
              : 'Off for this device'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          disabled={isWorking}
          onClick={() => {
            if (isOn) { void turnOff(); }
            else if (permission === 'default') { setShowPrimer(true); }
            else { void turnOn(); }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 ${
            isOn ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isOn ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
