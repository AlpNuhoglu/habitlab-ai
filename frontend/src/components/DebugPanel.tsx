import { createPortal } from 'react-dom';
import { BuildInfo } from '../lib/observability/build-info';
import { getRecentRequestIds, useCurrentRequestId } from '../lib/observability/request-id';
import { useHealthProbe } from '../lib/observability/health/use-health-probe';
import { useOnlineState } from '../lib/observability/online/use-online-state';

// Tree-shaken from production builds: the outer condition is a compile-time constant.
const IS_DEBUG_ELIGIBLE =
  import.meta.env.DEV || import.meta.env.MODE === 'staging';

function DebugPanelInner(): React.ReactElement {
  const requestId = useCurrentRequestId();
  const { state: healthState } = useHealthProbe();
  const online = useOnlineState();
  const recent = getRecentRequestIds();

  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  if (params.get('debug') !== 'info') return <></>;

  const panel = (
    <div
      style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999, width: 320 }}
      className="rounded-lg border border-gray-700 bg-gray-900/95 p-3 font-mono text-xs text-gray-200 shadow-xl"
    >
      <div className="mb-2 font-bold text-indigo-400">HabitLab Debug</div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Build: </span>
          {BuildInfo.gitSha}
        </div>
        <div>
          <span className="text-gray-400">Built: </span>
          {BuildInfo.buildTime}
        </div>
        <div>
          <span className="text-gray-400">Env: </span>
          {BuildInfo.env}
        </div>
        <div>
          <span className="text-gray-400">Request ID: </span>
          {requestId ?? '—'}
        </div>
        <div>
          <span className="text-gray-400">Health: </span>
          <span
            className={
              healthState === 'ok'
                ? 'text-green-400'
                : healthState === 'maintenance'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }
          >
            {healthState}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Online: </span>
          <span className={online ? 'text-green-400' : 'text-red-400'}>
            {online ? 'yes' : 'no'}
          </span>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-2 border-t border-gray-700 pt-2">
          <div className="mb-1 text-gray-400">Recent request IDs:</div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto">
            {[...recent].reverse().map((entry, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate text-gray-500">{entry.route}</span>
                <button
                  type="button"
                  className="shrink-0 text-indigo-400 hover:text-indigo-300"
                  onClick={() => void navigator.clipboard.writeText(entry.requestId)}
                  title="Copy request ID"
                >
                  {entry.requestId.slice(0, 8)}…
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(panel, document.body) as React.ReactElement;
}

export function DebugPanel(): React.ReactElement | null {
  if (!IS_DEBUG_ELIGIBLE) return null;
  return <DebugPanelInner />;
}
