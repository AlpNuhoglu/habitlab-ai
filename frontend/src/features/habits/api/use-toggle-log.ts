import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiFetch, ApiException } from '../../../api/client';
import { generateIdempotencyKey, type IdempotencyKey } from '../../../api/idempotency';
import { analyticsKeys, habitKeys, dashboardKeys } from '../../../api/query-keys';
import { toast } from '../../../hooks/use-toast';
import { coalesceToggle } from '../lib/log-coalesce';
import type { CalendarDay, Habit, DashboardSummary, ToggleLogContext } from '../types';

interface ToggleLogArgs {
  habitId: string;
  date: string;
  currentStatus: 'completed' | 'skipped' | 'pending' | null;
}

// Patch every cached calendar window that contains `date` for this habit.
// habitKeys.calendar uses prefix ['habits','detail',id,'calendar',…] so we
// match all windows without needing the exact from/to params.
function patchCalendarCache(
  queryClient: ReturnType<typeof useQueryClient>,
  habitId: string,
  date: string,
  remove: boolean,
): void {
  // Scope to habitKeys.detail(habitId) so only this habit's calendar windows are touched.
  // Using habitKeys.details() (no id) would match every habit and corrupt the entire column.
  queryClient.setQueriesData<CalendarDay[]>(
    { queryKey: habitKeys.detail(habitId), exact: false },
    (existing) => {
      if (!existing || !Array.isArray(existing)) return existing;
      if (remove) {
        return existing.filter((d) => d.date !== date);
      }
      const already = existing.find((d) => d.date === date);
      if (already) {
        return existing.map((d) =>
          d.date === date ? { ...d, status: 'completed' as const } : d,
        );
      }
      return [...existing, { date, status: 'completed' as const }];
    },
  );
}

/** Maps a failed toggle to a short, user-readable message. */
function toggleErrorMessage(err: unknown): string {
  if (err instanceof ApiException) {
    switch (err.error.kind) {
      case 'network':
        return "Couldn't reach the server — check your connection and try again.";
      case 'conflict':
        return err.error.message;
      case 'validation':
        // Backend rejects logs older than 7 days or in the future.
        return err.error.fields['_form']?.[0] ?? "That date can't be logged.";
      case 'rate_limited':
        return 'Too many requests — please wait a moment and try again.';
      default:
        return "Couldn't save that change. Please try again.";
    }
  }
  return "Couldn't save that change. Please try again.";
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

      // Optimistic update fires immediately on click — before the 250ms debounce fires.
      // This makes the tracker grid cell respond instantly.
      patchCalendarCache(queryClient, habitId, date, intent === 'unlog');

      coalesceToggle(habitId, date, intent, async (resolvedIntent) => {
        const idemKey = idemKeysRef.current.get(coalesceKey);
        // Snapshot current caches for rollback
        const snapshotDetail = queryClient.getQueryData<Habit>(habitKeys.detail(habitId));
        const snapshotDashboard = queryClient.getQueryData<DashboardSummary>(
          dashboardKeys.summary(),
        );
        // Snapshot only this habit's calendar windows so rollback doesn't touch other habits.
        const calendarSnapshots = new Map<readonly unknown[], CalendarDay[]>();
        queryClient.getQueriesData<CalendarDay[]>({ queryKey: habitKeys.detail(habitId), exact: false })
          .forEach(([key, data]) => {
            if (data && Array.isArray(data)) calendarSnapshots.set(key, data);
          });

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

        // Optimistic update for detail + dashboard (calendar already patched above)
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
        } catch (err) {
          // Rollback all caches to pre-click state
          if (context.snapshotDetail) {
            queryClient.setQueryData(habitKeys.detail(habitId), context.snapshotDetail);
          }
          if (context.snapshotDashboard) {
            queryClient.setQueryData(dashboardKeys.summary(), context.snapshotDashboard);
          }
          calendarSnapshots.forEach((data, key) => {
            queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data);
          });
          // Surface the failure — this callback runs detached from any mutation, so
          // without a toast the cell would silently revert with no explanation.
          toast(toggleErrorMessage(err), 'error');
        } finally {
          idemKeysRef.current.delete(coalesceKey);
          // Reconcile with server truth
          void queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) });
          void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
          void queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
        }
      });
    },
    [queryClient],
  );

  return { toggle };
}
