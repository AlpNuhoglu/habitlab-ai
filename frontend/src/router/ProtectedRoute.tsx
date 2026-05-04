import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/api/use-current-user';
import { AuthBootstrap } from '../features/auth/components/AuthBootstrap';

interface ProtectedRouteProps {
  readonly requireVerified?: boolean;
}

export function ProtectedRoute({
  requireVerified = true,
}: ProtectedRouteProps): React.ReactElement {
  const { user, isAuthenticated, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <AuthBootstrap />;

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (requireVerified && user?.emailVerifiedAt === null) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}
