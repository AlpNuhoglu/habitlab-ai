import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { initRefreshMutex } from './api/refresh-mutex';
import { authKeys } from './api/query-keys';
import { onAuthMessage } from './lib/broadcast';
import { router } from './router/routes';
import { App } from './App';
import { ensureServiceWorker } from './features/notifications/lib/sw-registration';
import { capturePwaInstallPrompt } from './features/notifications/components/PwaInstallPrompt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Give the refresh mutex a reference to the query client so it can
// clear the auth.me cache when a refresh fails (before redirecting).
initRefreshMutex(queryClient);

// Multi-tab auth synchronisation via BroadcastChannel.
// Tab A logs out → Tab B clears its cache and redirects to /login.
// Tab A logs in → Tab B re-validates its auth.me query.
onAuthMessage((msg) => {
  if (msg.type === 'LOGOUT') {
    queryClient.removeQueries();
    void router.navigate('/login', { replace: true });
  } else if (msg.type === 'SESSION_EXPIRED') {
    queryClient.removeQueries();
    void router.navigate('/login?reason=expired', { replace: true });
  } else if (msg.type === 'LOGIN') {
    void queryClient.invalidateQueries({ queryKey: authKeys.me() });
  }
});

// Capture beforeinstallprompt before React renders.
capturePwaInstallPrompt();

// Register SW on prod and when explicitly opted-in during dev.
if (import.meta.env.PROD || import.meta.env['VITE_SW_DEV'] === 'true') {
  void ensureServiceWorker();
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
