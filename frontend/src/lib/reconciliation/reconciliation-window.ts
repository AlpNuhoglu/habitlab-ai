export interface ReconciliationProbe<T> {
  readonly fetch: () => Promise<T>;
  readonly predicate: (data: T) => boolean;
  readonly maxWaitMs?: number;
  readonly pollIntervalMs?: number;
}

export interface ReconciliationResult<T> {
  readonly satisfied: boolean;
  readonly elapsedMs: number;
  readonly attempts: number;
  readonly lastValue: T | null;
}

/**
 * Polls `probe.fetch` until `probe.predicate` returns true or `maxWaitMs` elapses.
 * Used only in tests and dev tooling — not in production code paths.
 */
export async function awaitReconciliation<T>(
  probe: ReconciliationProbe<T>,
): Promise<ReconciliationResult<T>> {
  const maxWaitMs = probe.maxWaitMs ?? 1000;
  const pollIntervalMs = probe.pollIntervalMs ?? 50;
  const start = Date.now();
  let attempts = 0;
  let lastValue: T | null = null;

  while (Date.now() - start < maxWaitMs) {
    try {
      lastValue = await probe.fetch();
      attempts += 1;
      if (probe.predicate(lastValue)) {
        return { satisfied: true, elapsedMs: Date.now() - start, attempts, lastValue };
      }
    } catch {
      attempts += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { satisfied: false, elapsedMs: Date.now() - start, attempts, lastValue };
}

export function assertReconciliationWindow(ms: number, ceiling = 1000): void {
  if (ms > ceiling) {
    console.warn(
      `[reconciliation] window breached: ${ms}ms > ${ceiling}ms ceiling. ` +
        'Check broker fanout latency and analytics worker performance.',
    );
  }
}
