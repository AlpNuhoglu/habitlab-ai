import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/api/use-current-user';
import { useLogout } from '../features/auth/api/use-logout';
import { ExperimentsBoundary } from '../features/experiments/components/ExperimentsBoundary';
import { SwUpdateBanner, PushToast, reconcileLocalSubscription } from '../features/notifications';
import { MaintenanceBanner } from './MaintenanceBanner';
import { OfflineBanner } from './OfflineBanner';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/habits',   label: 'Habits'    },
  { to: '/track',    label: 'Tracker'   },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings'  },
] as const;

export function AppLayout(): React.ReactElement {
  const { user } = useCurrentUser();
  const logout = useLogout();

  const userId = user?.id;
  useEffect(() => {
    if (userId) void reconcileLocalSubscription(userId);
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MaintenanceBanner />
      <OfflineBanner />
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-tight text-indigo-600">HabitLab</span>
            <div className="hidden gap-1 sm:flex">
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-xs text-gray-400 sm:block">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <ExperimentsBoundary>
          <Outlet />
        </ExperimentsBoundary>
      </main>

      <SwUpdateBanner />
      <PushToast />
    </div>
  );
}
