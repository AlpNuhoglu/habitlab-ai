import { useMutation } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import type { RequestResetValues } from '../schema/request-reset.schema';

export function useRequestReset() {
  return useMutation<void, ApiException, RequestResetValues>({
    mutationFn: ({ email }) =>
      apiFetch<void>('/api/v1/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    retry: false,
  });
}
