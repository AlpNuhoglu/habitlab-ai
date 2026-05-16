import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ApiException, apiFetch } from '../../../api/client';
import { authKeys } from '../../../api/query-keys';
import { postLogout } from '../../../lib/broadcast';
import { clearExposures } from '../../experiments/lib/exposure-dedup';

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, ApiException, void>({
    mutationFn: () => apiFetch<void>('/api/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.removeQueries();
      clearExposures();
      postLogout();
      navigate('/login', { replace: true });
    },
    retry: false,
  });
}
