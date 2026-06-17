import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/api/use-current-user';
import { useLogout } from '../features/auth/api/use-logout';
import { ExperimentsBoundary } from '../features/experiments/components/ExperimentsBoundary';
import { SwUpdateBanner, PushToast, reconcileLocalSubscription } from '../features/notifications';
import { MaintenanceBanner } from './MaintenanceBanner';
import { OfflineBanner } from './OfflineBanner';
import { ToastContainer } from './ToastContainer';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/habits',    label: 'Habits'    },
  { to: '/track',     label: 'Tracker'   },
  { to: '/analytics', label: 'Analytics' },
  { to: '/coach',     label: 'AI Coach'  },
  { to: '/settings',  label: 'Settings'  },
] as const;

export function AppLayout(): React.ReactElement {
  const { user } = useCurrentUser();
  const logout = useLogout();

  const userId = user?.id;
  useEffect(() => {
    if (userId) void reconcileLocalSubscription(userId);
  }, [userId]);

  return (
    <div className="min-h-screen bg-black">
      <MaintenanceBanner />
      <OfflineBanner />
      <nav className="border-b border-purple-500/20 bg-black/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-widest uppercase bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              HabitLab
            </span>
            <div className="hidden gap-1 sm:flex">
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition-all ${
                      isActive
                        ? 'bg-purple-500/10 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                        : 'text-gray-400 hover:bg-gray-800/60 hover:text-cyan-400'
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
              <span className="hidden text-xs text-gray-500 sm:block font-mono">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-md px-3 py-1.5 text-xs font-medium tracking-wider uppercase text-gray-400 border border-gray-700 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-50"
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
                `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition-all ${
                  isActive
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'text-gray-400 hover:bg-gray-800/60'
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
      <ToastContainer />
    </div>
  );
}
