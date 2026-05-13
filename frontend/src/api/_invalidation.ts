import type { QueryClient } from '@tanstack/react-query';

import { analyticsKeys, dashboardKeys, habitKeys } from './query-keys';

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
