// Dev-only — compiled away in production builds.
import { useQueryClient } from '@tanstack/react-query';

import { experimentKeys } from '../../../api/query-keys';
import type { AssignmentsMap, KnownExperimentKey } from '../lib/slot-registry';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';

function useDebugVisible(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === 'experiments';
}

export function ExperimentsDebugPanel(): React.ReactElement | null {
  if (!import.meta.env.DEV) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const visible = useDebugVisible();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const queryClient = useQueryClient();

  if (!visible) return null;

  const assignments = queryClient.getQueryData<AssignmentsMap>(
    experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
  );

  function forceVariant(key: KnownExperimentKey, variant: string): void {
    queryClient.setQueryData<AssignmentsMap>(
      experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
      (prev) => ({ ...prev, [key]: variant }),
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl text-xs">
      <p className="mb-2 font-bold text-gray-700">Experiments debug</p>
      {KNOWN_EXPERIMENT_KEYS.map((key) => (
        <div key={key} className="mb-2">
          <p className="font-mono text-gray-500">{key}</p>
          <p className="font-semibold text-indigo-600">{assignments?.[key] ?? '(unhydrated)'}</p>
          <div className="mt-1 flex gap-1">
            {['control', 'treatment'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => forceVariant(key, v)}
                className="rounded bg-gray-100 px-2 py-0.5 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
