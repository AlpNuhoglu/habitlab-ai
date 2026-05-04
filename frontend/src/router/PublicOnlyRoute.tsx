import { Navigate, Outlet, useSearchParams } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/api/use-current-user';
import { AuthBootstrap } from '../features/auth/components/AuthBootstrap';

function resolveNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.includes('://') || next.includes('\\')) {
    return '/dashboard';
  }
  return next;
}

export function PublicOnlyRoute(): React.ReactElement {
  const { isAuthenticated, isPending } = useCurrentUser();
  const [searchParams] = useSearchParams();

  if (isPending) return <AuthBootstrap />;

  if (isAuthenticated) {
    return <Navigate to={resolveNext(searchParams.get('next'))} replace />;
  }

  return <Outlet />;
}
