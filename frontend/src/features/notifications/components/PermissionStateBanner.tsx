import type { PermissionStateTri } from '../hooks/use-push-permission';

interface Props {
  permission: PermissionStateTri;
}

export function PermissionStateBanner({ permission }: Props): React.ReactElement | null {
  if (permission === 'granted') return null;

  if (permission === 'denied') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <strong>Notifications are blocked.</strong> To enable them, click the lock icon in your browser&apos;s address bar and allow notifications for this site.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      Enable notifications to receive habit reminders at your preferred time.
    </div>
  );
}
