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
      className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
    >
      <span>
        {state === 'maintenance'
          ? 'HabitLab is undergoing maintenance. Some features may be unavailable.'
          : "We're seeing degraded performance. Things may be slower than usual."}
        {incidentId && (
          <span className="ml-2 text-xs opacity-70">Ref: {incidentId}</span>
        )}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="ml-4 text-amber-600 hover:text-amber-800"
      >
        ✕
      </button>
    </div>
  );
}
