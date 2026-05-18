/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
