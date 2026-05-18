import { useEffect } from 'react';
import { detectPushCapability } from '../lib/push-capability';
import { reconcileLocalSubscription } from '../lib/reconcile-subscription';
import { useCurrentUser } from '../../auth/api/use-current-user';
import { usePushPermission } from '../hooks/use-push-permission';
import { UnsupportedBrowserNotice } from '../components/UnsupportedBrowserNotice';
import { PermissionStateBanner } from '../components/PermissionStateBanner';
import { MasterPushToggle } from '../components/MasterPushToggle';
import { QuietHoursEditor } from '../components/QuietHoursEditor';
import { DeviceList } from '../components/DeviceList';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';

export function NotificationsSettingsPage(): React.ReactElement {
  const cap = detectPushCapability();
  const { permission } = usePushPermission();
  const { user } = useCurrentUser();

  // Re-run reconciliation when the user focuses this page.
  useEffect(() => {
    if (user) void reconcileLocalSubscription(user.id);
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage push reminders for your habits.
        </p>
      </div>

      {!cap.isSupportedBrowser ? (
        <UnsupportedBrowserNotice />
      ) : (
        <>
          <PermissionStateBanner permission={permission} />

          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <MasterPushToggle />
          </section>

          {permission === 'granted' && (
            <>
              <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <QuietHoursEditor />
              </section>

              <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <DeviceList />
              </section>
            </>
          )}

          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-900">Test notification</h2>
            <p className="mt-1 text-xs text-gray-500">
              Send a test push to verify your setup.
            </p>
            <div className="mt-3">
              <button
                type="button"
                disabled
                title="Coming soon"
                className="cursor-not-allowed rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-400"
              >
                Send test notification
              </button>
              <p className="mt-1 text-xs text-gray-400">Coming soon</p>
            </div>
          </section>

          <PwaInstallPrompt />
        </>
      )}
    </div>
  );
}
