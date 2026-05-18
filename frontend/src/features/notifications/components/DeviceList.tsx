import { useListSubscriptions } from '../api/use-list-subscriptions';
import { useUnsubscribe } from '../api/use-unsubscribe';
import { useCurrentSubscription } from '../hooks/use-current-subscription';
import { postSubscriptionChanged } from '../lib/push-channel';

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Safari';
  if (/Android/.test(ua) && /Chrome/.test(ua)) return 'Android Chrome';
  if (/Chrome/.test(ua)) return 'Chrome';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Safari/.test(ua)) return 'Safari';
  return 'Browser';
}

export function DeviceList(): React.ReactElement {
  const { data: subs, isLoading } = useListSubscriptions();
  const { endpoint: currentEndpoint } = useCurrentSubscription();
  const unsubscribe = useUnsubscribe();

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading devices…</p>;
  }

  if (!subs || subs.length === 0) {
    return <p className="text-sm text-gray-500">No registered devices.</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Registered devices</h3>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {subs.map((sub) => {
          const isCurrent = sub.endpoint === currentEndpoint;
          return (
            <li key={sub.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {parseUserAgent(sub.userAgent)}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  Added {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={unsubscribe.isPending}
                onClick={async () => {
                  if (isCurrent) {
                    const reg = await navigator.serviceWorker.ready.catch(() => null);
                    if (reg) {
                      const browserSub = await reg.pushManager.getSubscription().catch(() => null);
                      if (browserSub) await browserSub.unsubscribe().catch(() => undefined);
                    }
                  }
                  unsubscribe.mutate(sub.id, {
                    onSuccess: () => postSubscriptionChanged('removed'),
                  });
                }}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
