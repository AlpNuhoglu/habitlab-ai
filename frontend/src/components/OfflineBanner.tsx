import { useOnlineState } from '../lib/observability/online/use-online-state';

export function OfflineBanner(): React.ReactElement | null {
  const online = useOnlineState();
  if (online) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-40 bg-gray-800 px-4 py-2 text-center text-sm text-white"
    >
      You&apos;re offline. Changes will sync when you reconnect.
    </div>
  );
}
