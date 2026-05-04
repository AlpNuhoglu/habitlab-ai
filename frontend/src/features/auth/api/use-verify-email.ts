import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';

export function useVerifyEmail() {
  const navigate = useNavigate();

  return useMutation<void, ApiException, string>({
    mutationFn: (token: string) =>
      apiFetch<void>(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`, {
        method: 'GET',
      }),
    onSuccess: () => {
      // D1: Backend does not set a session cookie on verify — user must log in explicitly.
      navigate('/login?verified=1', { replace: true });
    },
    retry: false,
  });
}
