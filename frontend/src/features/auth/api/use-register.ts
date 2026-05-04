import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';
import type { RegisterValues } from '../schema/register.schema';

export function useRegister() {
  const navigate = useNavigate();

  return useMutation<void, ApiException, RegisterValues>({
    mutationFn: ({ email, password }) =>
      apiFetch<void>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          consentGiven: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language.startsWith('tr') ? 'tr' : 'en',
        }),
      }),
    onSuccess: () => {
      navigate('/register/check-email', { replace: true });
    },
    retry: false,
  });
}
