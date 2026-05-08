import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../api/client';
import { dashboardKeys } from '../../../api/query-keys';
import type { DashboardSummary } from '../../habits/types';

export function useDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: dashboardKeys.summary(),
    queryFn: () => apiFetch<DashboardSummary>('/api/v1/dashboard'),
    staleTime: 280_000, // slightly under server TTL of 300s
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
