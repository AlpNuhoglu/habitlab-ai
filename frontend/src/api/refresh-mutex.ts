import type { QueryClient } from '@tanstack/react-query';

import { postSessionExpired } from '../lib/broadcast';
import { authKeys } from './query-keys';

let _queryClient: QueryClient | null = null;
let _inflightRefresh: Promise<void> | null = null;

export function initRefreshMutex(queryClient: QueryClient): void {
  _queryClient = queryClient;
}

async function doRefresh(): Promise<void> {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    _queryClient?.setQueryData(authKeys.me(), null);
    postSessionExpired();
    window.location.replace('/login?reason=expired');
    throw new Error('refresh_failed');
  }
}

export function refreshOnce(): Promise<void> {
  if (_inflightRefresh) return _inflightRefresh;
  _inflightRefresh = doRefresh().finally(() => {
    _inflightRefresh = null;
  });
  return _inflightRefresh;
}
