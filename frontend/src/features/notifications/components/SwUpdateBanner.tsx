import { useEffect, useState } from 'react';

export function useSwUpdate(): { updateAvailable: boolean; applyUpdate: () => void } {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.ready.then((r) => {
      if (r.waiting) setWaiting(r.waiting);
      r.addEventListener('updatefound', () => {
        const newSw = r.installing;
        if (!newSw) return;
        newSw.addEventListener('statechange', () => {
          if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(newSw);
          }
        });
      });
    });
  }, []);

  function applyUpdate(): void {
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }

  return { updateAvailable: waiting !== null, applyUpdate };
}

export function SwUpdateBanner(): React.ReactElement | null {
  const { updateAvailable, applyUpdate } = useSwUpdate();
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <p className="text-sm text-indigo-800">A new version of HabitLab is available.</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
