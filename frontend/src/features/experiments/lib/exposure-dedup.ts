// Module-level Set dedupes exposures per experimentKey across the session.
// Resets only on logout (clearExposures) or explicit test teardown.
const _seen = new Set<string>();

export function hasSeenExposure(experimentKey: string): boolean {
  return _seen.has(experimentKey);
}

export function markExposureSeen(experimentKey: string): void {
  _seen.add(experimentKey);
}

export function clearExposures(): void {
  _seen.clear();
}

// Exposed for tests only — resets state between cases.
export function _resetSeenForTesting(): void {
  _seen.clear();
}
