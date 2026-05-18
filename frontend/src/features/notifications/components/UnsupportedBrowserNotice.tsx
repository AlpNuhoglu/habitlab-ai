import { detectPushCapability } from '../lib/push-capability';

export function UnsupportedBrowserNotice(): React.ReactElement | null {
  const cap = detectPushCapability();
  if (cap.isSupportedBrowser) return null;

  const isPrivate = cap.reason === 'private-mode';
  const isIOS = cap.isIOS;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-base font-semibold text-amber-900">Push notifications not available</h2>
      <p className="mt-2 text-sm text-amber-800">
        {isIOS
          ? 'iOS Safari supports Web Push only on iOS 16.4+. Add HabitLab to your Home Screen and open it from there to enable notifications.'
          : isPrivate
          ? 'Private browsing mode blocks notifications. Open HabitLab in a regular browser window to enable them.'
          : 'Your browser does not support Web Push notifications. Try Chrome, Edge, or Firefox on a supported platform.'}
      </p>
      <p className="mt-2 text-sm text-amber-700">
        You can still use HabitLab — your quiet hours and other settings are saved for when you visit from a supported browser.
      </p>
    </div>
  );
}
