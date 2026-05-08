/**
 * TP-3 integration test — runs against a live backend (staging).
 * Skipped in CI unless VITE_RUN_RECONCILIATION_TESTS=true.
 *
 * What it verifies:
 *   POST /habits/:id/logs → GET /dashboard reflects updated streak within 1000ms.
 * This is the canary for WP4 broker fanout latency regressions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { awaitReconciliation, assertReconciliationWindow } from './reconciliation-window';

const RUN = import.meta.env.VITE_RUN_RECONCILIATION_TESTS === 'true';
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

// Shared test state — populated in beforeAll
let habitId: string;
const CEILING_MS = 1000;

async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

describe.skipIf(!RUN)('TP-3 reconciliation window (staging only)', () => {
  beforeAll(async () => {
    // Create a throwaway habit for the probe
    const habit = await apiCall<{ id: string }>('/api/v1/habits', {
      method: 'POST',
      body: JSON.stringify({
        name: `reconciliation-probe-${Date.now()}`,
        frequencyType: 'daily',
        difficulty: 1,
      }),
    });
    habitId = habit.id;
  });

  afterAll(async () => {
    if (habitId) {
      // Hard-delete the probe habit so staging stays clean
      await apiCall(`/api/v1/habits/${habitId}?hard=true`, { method: 'DELETE' }).catch(() => null);
    }
  });

  it('dashboard reflects logged habit within 1000ms', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Trigger the mutation
    await apiCall(`/api/v1/habits/${habitId}/log`, {
      method: 'POST',
      body: JSON.stringify({ status: 'completed', date: today }),
    });

    interface DashboardHabit {
      id: string;
      todayStatus: string;
    }
    interface Dashboard {
      habits: DashboardHabit[];
    }

    const result = await awaitReconciliation<Dashboard>({
      fetch: () => apiCall<Dashboard>('/api/v1/dashboard'),
      predicate: (data) =>
        data.habits.some((h) => h.id === habitId && h.todayStatus === 'completed'),
      maxWaitMs: CEILING_MS,
      pollIntervalMs: 50,
    });

    assertReconciliationWindow(result.elapsedMs, CEILING_MS);

    expect(result.satisfied).toBe(true);
    expect(result.elapsedMs).toBeLessThanOrEqual(CEILING_MS);
  });
});
