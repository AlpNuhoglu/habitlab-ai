import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let _capturedPrompt: BeforeInstallPromptEvent | null = null;

export function capturePwaInstallPrompt(): void {
  window.addEventListener(
    'beforeinstallprompt',
    (e) => {
      e.preventDefault();
      _capturedPrompt = e as BeforeInstallPromptEvent;
    },
    { once: true },
  );
}

export function PwaInstallPrompt(): React.ReactElement | null {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setAvailable(_capturedPrompt !== null);
    const handler = () => setAvailable(_capturedPrompt !== null);
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!available || dismissed) return null;

  async function handleInstall(): Promise<void> {
    if (!_capturedPrompt) return;
    const result = await _capturedPrompt.prompt();
    _capturedPrompt = null;
    setAvailable(false);
    if (result.outcome === 'dismissed') setDismissed(true);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-medium text-gray-900">Install HabitLab</p>
      <p className="mt-1 text-xs text-gray-500">
        Add to your home screen for the best push notification experience.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => { void handleInstall(); }}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
        >
          Add to home screen
        </button>
        <button
          type="button"
          onClick={() => { setDismissed(true); _capturedPrompt = null; setAvailable(false); }}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
