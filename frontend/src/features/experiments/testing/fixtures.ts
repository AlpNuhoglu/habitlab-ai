import type { AssignmentsMap, KnownExperimentKey } from '../lib/slot-registry';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';

// Returns an AssignmentsMap with all known keys set to 'control' by default.
// Override specific keys to test treatment paths.
export function makeAssignmentsMap(
  overrides?: Partial<Record<KnownExperimentKey, string>>,
): AssignmentsMap {
  const base: AssignmentsMap = Object.fromEntries(
    KNOWN_EXPERIMENT_KEYS.map((k) => [k, 'control']),
  );
  return { ...base, ...overrides };
}
