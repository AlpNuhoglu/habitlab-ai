import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { analyticsKeys, dashboardKeys, habitKeys, recommendationKeys } from './query-keys';
import type { RecommendationCategory } from '../features/recommendations/types';

export async function invalidateOnHabitChange(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
    queryClient.invalidateQueries({ queryKey: analyticsKeys.global() }),
  ]);
}

export async function invalidateOnLogChange(
  queryClient: QueryClient,
  habitId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
    queryClient.invalidateQueries({ queryKey: analyticsKeys.all }),
  ]);
}

export async function invalidateOnDashboard(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() });
}

export async function invalidateHabitFull(
  queryClient: QueryClient,
  habitId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) }),
    queryClient.invalidateQueries({ queryKey: habitKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
    queryClient.invalidateQueries({ queryKey: analyticsKeys.all }),
  ]);
}

export async function invalidateOnAnalytics(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
}

// Returns the query keys that must be invalidated after an accept, based on category.
// Only reschedule produces a habit side-effect today (CLAUDE.md WP6).
export function invalidationKeysForAccept(
  category: RecommendationCategory,
  habitId: string | null,
): QueryKey[] {
  const base: QueryKey[] = [recommendationKeys.active(), dashboardKeys.summary()];
  if (category === 'reschedule' && habitId) {
    return [...base, habitKeys.detail(habitId), habitKeys.lists()];
  }
  return base;
}

export async function invalidateOnRecommendationAccept(
  queryClient: QueryClient,
  category: RecommendationCategory,
  habitId: string | null,
): Promise<void> {
  const keys = invalidationKeysForAccept(category, habitId);
  await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: k })));
}

export async function invalidateOnRecommendationDismiss(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: recommendationKeys.active() }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() }),
  ]);
}
