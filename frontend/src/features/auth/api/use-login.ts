import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';
import { authKeys } from '../../../api/query-keys';
import type { LoginValues } from '../schema/login.schema';

function resolveNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.includes('://') || next.includes('\\')) {
    return '/dashboard';
  }
  return next;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useMutation<void, ApiException, LoginValues>({
    mutationFn: ({ email, password }) =>
      apiFetch<void>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      navigate(resolveNext(searchParams.get('next')), { replace: true });
    },
    retry: false,
  });
}
