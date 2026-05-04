import { useQuery } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { authKeys } from '../../../api/query-keys';
import type { AuthUser, CurrentUserState } from '../types';

export function useCurrentUser(): CurrentUserState {
  const { data, isPending, isError } = useQuery<AuthUser | null, ApiException>({
    queryKey: authKeys.me(),
    queryFn: async () => {
      try {
        return await apiFetch<AuthUser>('/api/v1/me', undefined, { skipRefresh: true });
      } catch (e) {
        if (e instanceof ApiException && e.error.kind === 'unauthorized') return null;
        throw e;
      }
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  return {
    user: data ?? null,
    isAuthenticated: data != null,
    isPending,
    isError,
  };
}
