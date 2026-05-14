import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiException, apiFetch } from '../../../api/client';
import { useMutationIdempotency } from '../../../api/idempotency';
import { invalidateOnRecommendationAccept } from '../../../api/_invalidation';
import { habitKeys, recommendationKeys, dashboardKeys } from '../../../api/query-keys';
import { postHabitMutated } from '../../../lib/broadcast';
import { emitRecommendationAccepted } from '../../../lib/events/use-emit-event';
import { toast } from '../../../hooks/use-toast';
import type { Recommendation } from '../types';
import type { DashboardSummary } from '../../habits/types';
import type { Habit } from '../../habits/types';

export interface AcceptVars {
  readonly recommendation: Recommendation;
  readonly habitName: string | null;
}

interface AcceptContext {
  readonly snapshotRecs: Recommendation[] | undefined;
  readonly snapshotDashboard: DashboardSummary | undefined;
  readonly snapshotHabit: Habit | undefined;
}

export function useAcceptRecommendation() {
  const queryClient = useQueryClient();
  const { getOrCreateKey, clearKey } = useMutationIdempotency();

  return useMutation<void, ApiException, AcceptVars, AcceptContext>({
    mutationFn: ({ recommendation }) =>
      apiFetch<void>(
        `/api/v1/recommendations/${recommendation.id}/accept`,
        { method: 'POST' },
        { idempotencyKey: getOrCreateKey() },
      ),

    onMutate: async ({ recommendation }) => {
      const { id, category, habitId, actionPayload } = recommendation;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: recommendationKeys.active() }),
        queryClient.cancelQueries({ queryKey: dashboardKeys.summary() }),
        ...(category === 'reschedule' && habitId
          ? [queryClient.cancelQueries({ queryKey: habitKeys.detail(habitId) })]
          : []),
      ]);

      const snapshotRecs = queryClient.getQueryData<Recommendation[]>(recommendationKeys.active());
      const snapshotDashboard = queryClient.getQueryData<DashboardSummary>(dashboardKeys.summary());
      const snapshotHabit =
        category === 'reschedule' && habitId
          ? queryClient.getQueryData<Habit>(habitKeys.detail(habitId))
          : undefined;

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

      // Optimistic: patch habit preferred_time for reschedule
      if (
        category === 'reschedule' &&
        habitId &&
        snapshotHabit &&
        actionPayload !== null &&
        actionPayload.category === 'reschedule'
      ) {
        queryClient.setQueryData<Habit>(habitKeys.detail(habitId), {
          ...snapshotHabit,
          preferredTime: actionPayload.preferredTime,
        });
      }

      return { snapshotRecs, snapshotDashboard, snapshotHabit };
    },

    onError: (_err, { recommendation }, context) => {
      if (context?.snapshotRecs !== undefined) {
        queryClient.setQueryData(recommendationKeys.active(), context.snapshotRecs);
      }
      if (context?.snapshotDashboard !== undefined) {
        queryClient.setQueryData(dashboardKeys.summary(), context.snapshotDashboard);
      }
      if (
        recommendation.category === 'reschedule' &&
        recommendation.habitId &&
        context?.snapshotHabit !== undefined
      ) {
        queryClient.setQueryData(habitKeys.detail(recommendation.habitId), context.snapshotHabit);
      }
      toast("Couldn't apply — try again.", 'error');
    },

    onSuccess: (_data, { recommendation }) => {
      const { id, category, source, habitId } = recommendation;
      emitRecommendationAccepted(id, category, source);

      // Notify other tabs that a habit was mutated (reschedule patches preferred_time)
      if (category === 'reschedule' && habitId) {
        postHabitMutated({
          habitId,
          source: 'recommendation_accept',
          fields: ['preferred_time'],
        });
      }
    },

    onSettled: async (_data, _err, { recommendation }) => {
      clearKey();
      await invalidateOnRecommendationAccept(
        queryClient,
        recommendation.category,
        recommendation.habitId,
      );
    },

    retry: false,
  });
}
