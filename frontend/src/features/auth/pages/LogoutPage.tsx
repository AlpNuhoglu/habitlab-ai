import { useEffect } from 'react';

import { useLogout } from '../api/use-logout';

export function LogoutPage(): React.ReactElement {
  const logout = useLogout();

  useEffect(() => {
    logout.mutate();
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-center">
        <svg
          className="h-8 w-8 animate-spin text-navy-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-500">Signing out…</p>
      </div>
    </div>
  );
}
