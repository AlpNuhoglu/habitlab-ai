import { useMutation } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';

export function useResendVerification() {
  return useMutation<void, ApiException, { email: string }>({
    mutationFn: ({ email }) =>
      apiFetch<void>('/api/v1/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    retry: false,
  });
}
