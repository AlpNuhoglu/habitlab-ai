import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';
import type { ResetPasswordValues } from '../schema/reset-password.schema';

type ResetPasswordInput = ResetPasswordValues & { token: string };

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation<void, ApiException, ResetPasswordInput>({
    mutationFn: ({ token, newPassword }) =>
      apiFetch<void>('/api/v1/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
    onSuccess: () => {
      navigate('/login?passwordReset=1', { replace: true });
    },
    retry: false,
  });
}
