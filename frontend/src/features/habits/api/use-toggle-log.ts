import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { generateIdempotencyKey, type IdempotencyKey } from '../../../api/idempotency';
import { habitKeys, dashboardKeys } from '../../../api/query-keys';
import { coalesceToggle } from '../lib/log-coalesce';
import type { Habit, DashboardSummary, ToggleLogContext } from '../types';

interface ToggleLogArgs {
  habitId: string;
  date: string;
  currentStatus: 'completed' | 'skipped' | 'pending' | null;
}

export function useToggleLog() {
  const queryClient = useQueryClient();
  // Keys are keyed by `${habitId}:${date}`, mirroring coalesceToggle's pending map.
  // Generated on the first click of a debounce window; timer resets do not change the key.
  const idemKeysRef = useRef(new Map<string, IdempotencyKey>());

  const toggle = useCallback(
    ({ habitId, date, currentStatus }: ToggleLogArgs) => {
      const intent: 'log' | 'unlog' = currentStatus === 'completed' ? 'unlog' : 'log';
      const coalesceKey = `${habitId}:${date}`;

      if (!idemKeysRef.current.has(coalesceKey)) {
        idemKeysRef.current.set(coalesceKey, generateIdempotencyKey());
      }

      coalesceToggle(habitId, date, intent, async (resolvedIntent) => {
        const idemKey = idemKeysRef.current.get(coalesceKey);
        // Snapshot current caches
        const snapshotDetail = queryClient.getQueryData<Habit>(habitKeys.detail(habitId));
        const snapshotDashboard = queryClient.getQueryData<DashboardSummary>(
          dashboardKeys.summary(),
        );

        const context: ToggleLogContext = {
          snapshotDetail,
          snapshotDashboard,
          action: resolvedIntent,
          date,
        };

        // Cancel in-flight queries to prevent overwrite
        await Promise.all([
          queryClient.cancelQueries({ queryKey: habitKeys.detail(habitId) }),
          queryClient.cancelQueries({ queryKey: dashboardKeys.summary() }),
        ]);

        // Optimistic update
        if (snapshotDetail) {
          queryClient.setQueryData<Habit>(habitKeys.detail(habitId), {
            ...snapshotDetail,
            todayStatus: resolvedIntent === 'log' ? 'completed' : 'pending',
            currentStreak:
              resolvedIntent === 'log'
                ? snapshotDetail.currentStreak + 1
                : Math.max(0, snapshotDetail.currentStreak - 1),
          });
        }
        if (snapshotDashboard) {
          const delta = resolvedIntent === 'log' ? 1 : -1;
          queryClient.setQueryData<DashboardSummary>(dashboardKeys.summary(), {
            ...snapshotDashboard,
            summary: {
              ...snapshotDashboard.summary,
              todayCompleted: Math.max(
                0,
                snapshotDashboard.summary.todayCompleted + delta,
              ),
            },
            habits: snapshotDashboard.habits.map((h) =>
              h.id === habitId
                ? { ...h, todayStatus: resolvedIntent === 'log' ? 'completed' : 'pending' }
                : h,
            ),
          });
        }

        // Network call
        try {
          const idemOpts = idemKey !== undefined ? { idempotencyKey: idemKey } : undefined;
          if (resolvedIntent === 'log') {
            await apiFetch<void>(
              `/api/v1/habits/${habitId}/log`,
              { method: 'POST', body: JSON.stringify({ status: 'completed', date }) },
              idemOpts,
            );
          } else {
            await apiFetch<void>(
              `/api/v1/habits/${habitId}/log/${date}`,
              { method: 'DELETE' },
              idemOpts,
            );
          }
        } catch {
          // Rollback
          if (context.snapshotDetail) {
            queryClient.setQueryData(habitKeys.detail(habitId), context.snapshotDetail);
          }
          if (context.snapshotDashboard) {
            queryClient.setQueryData(dashboardKeys.summary(), context.snapshotDashboard);
          }
          // Surface error — caller can show toast
          throw new Error('Toggle failed');
        } finally {
          idemKeysRef.current.delete(coalesceKey);
          // Reconcile with server truth
          void queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) });
          void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
        }
      });
    },
    [queryClient],
  );

  return { toggle };
}
