import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { invalidateOnRecommendationDismiss } from '../../../api/_invalidation';
import { dashboardKeys, recommendationKeys } from '../../../api/query-keys';
import { emitRecommendationDismissed } from '../../../lib/events/use-emit-event';
import { toast } from '../../../hooks/use-toast';
import { cooldownMessage } from '../lib/cooldown-message';
import type { Recommendation } from '../types';
import type { DashboardSummary } from '../../habits/types';

export interface DismissVars {
  readonly recommendation: Recommendation;
  readonly habitName: string;
}

interface DismissContext {
  readonly snapshotRecs: Recommendation[] | undefined;
  readonly snapshotDashboard: DashboardSummary | undefined;
}

export function useDismissRecommendation() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<void, ApiException, DismissVars, DismissContext>({
    mutationFn: ({ recommendation }) =>
      apiFetch<void>(
        `/api/v1/recommendations/${recommendation.id}/dismiss`,
        { method: 'POST' },
        { idempotencyKey: getOrCreateKey() },
      ),

    onMutate: async ({ recommendation }) => {
      const { id } = recommendation;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: recommendationKeys.active() }),
        queryClient.cancelQueries({ queryKey: dashboardKeys.summary() }),
      ]);

      const snapshotRecs = queryClient.getQueryData<Recommendation[]>(recommendationKeys.active());
      const snapshotDashboard = queryClient.getQueryData<DashboardSummary>(dashboardKeys.summary());

      // Optimistic: remove from active feed
      if (snapshotRecs) {
        queryClient.setQueryData<Recommendation[]>(
          recommendationKeys.active(),
          snapshotRecs.filter((r) => r.id !== id),
        );
      }

      // Optimistic: remove from dashboard active recommendations
      if (snapshotDashboard) {
        queryClient.setQueryData<DashboardSummary>(dashboardKeys.summary(), {
          ...snapshotDashboard,
          activeRecommendations: snapshotDashboard.activeRecommendations.filter(
            (r) => r.id !== id,
          ),
        });
      }

      return { snapshotRecs, snapshotDashboard };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshotRecs !== undefined) {
        queryClient.setQueryData(recommendationKeys.active(), context.snapshotRecs);
      }
      if (context?.snapshotDashboard !== undefined) {
        queryClient.setQueryData(dashboardKeys.summary(), context.snapshotDashboard);
      }
      toast("Couldn't dismiss — try again.", 'error');
    },

    onSuccess: (_data, { recommendation, habitName }) => {
      const { id, category, source } = recommendation;
      // No undo affordance in v1 — dismiss is terminal (see wp6-7-plan.md §4.4)
      toast(cooldownMessage(habitName), 'info');
      emitRecommendationDismissed(id, category, source);
    },

    onSettled: async () => {
      clearKey();
      await invalidateOnRecommendationDismiss(queryClient);
    },

    retry: false,
  });
}
