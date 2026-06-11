import { useState } from 'react';
import { useHealthProbe } from '../lib/observability/health/use-health-probe';

export function MaintenanceBanner(): React.ReactElement | null {
  const { state, incidentId } = useHealthProbe();
  const sessionKey = `maintenance-dismissed-${incidentId ?? 'global'}`;
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(sessionKey) === '1',
  );

  if (state === 'ok' || state === 'unknown' || dismissed) return null;

  const handleDismiss = (): void => {
    sessionStorage.setItem(sessionKey, '1');
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-500/30 bg-amber-900/20 backdrop-blur-md px-4 py-2 text-sm text-amber-400"
    >
      <span>
        {state === 'maintenance'
          ? 'HabitLab is undergoing maintenance. Some features may be unavailable.'
          : "We're seeing degraded performance. Things may be slower than usual."}
        {incidentId && (
          <span className="ml-2 text-xs opacity-70 font-mono">Ref: {incidentId}</span>
        )}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="ml-4 text-amber-600 hover:text-amber-400 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
