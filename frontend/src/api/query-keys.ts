export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  csrf: () => [...authKeys.all, 'csrf'] as const,
} as const;

export interface HabitListFilters {
  readonly status: 'all' | 'active' | 'archived';
  readonly sort: 'name-asc' | 'name-desc' | 'created-desc' | 'streak-desc';
}

export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  list: (filters: HabitListFilters) => [...habitKeys.lists(), filters] as const,
  details: () => [...habitKeys.all, 'detail'] as const,
  detail: (id: string) => [...habitKeys.details(), id] as const,
  calendar: (id: string, from: string, to: string) =>
    [...habitKeys.detail(id), 'calendar', { from, to }] as const,
  analytics: (id: string) => [...habitKeys.detail(id), 'analytics'] as const,
} as const;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
} as const;

export const trackerKeys = {
  all: ['tracker'] as const,
  grid: (from: string, to: string) => [...trackerKeys.all, 'grid', { from, to }] as const,
} as const;

export const analyticsKeys = {
  all: ['analytics'] as const,
  global: () => [...analyticsKeys.all, 'global'] as const,
  habit: (habitId: string) => [...analyticsKeys.all, 'habit', habitId] as const,
} as const;

export const recommendationKeys = {
  all: ['recommendations'] as const,
  active: () => [...recommendationKeys.all, 'active'] as const,
} as const;

export const experimentKeys = {
  all: ['experiments'] as const,
  assignments: (keys: readonly string[]) =>
    [...experimentKeys.all, 'assignments', keys] as const,
} as const;

export const notificationKeys = {
  all: ['notifications'] as const,
  subscriptions: () => [...notificationKeys.all, 'subscriptions'] as const,
} as const;
