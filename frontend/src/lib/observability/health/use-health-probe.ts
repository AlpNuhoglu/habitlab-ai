import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { observabilityKeys } from '../../../api/query-keys';
import { enqueue } from '../../events/event-sink';

export type HealthState = 'ok' | 'degraded' | 'maintenance' | 'unknown';

interface HealthResponse {
  status: HealthState;
  incidentId?: string;
  message?: string;
}

export interface HealthProbeResult {
  state: HealthState;
  incidentId: string | undefined;
}

export function useHealthProbe(): HealthProbeResult {
  const enabled = import.meta.env['VITE_HEALTH_PROBE_ENABLED'] === 'true';

  const { data } = useQuery({
    queryKey: observabilityKeys.health(),
    queryFn: async (): Promise<HealthResponse> => {
      try {
        const res = await fetch('/healthz/public', { credentials: 'omit' });
        if (!res.ok) return { status: 'unknown' };
        return res.json() as Promise<HealthResponse>;
      } catch {
        return { status: 'unknown' };
      }
    },
    enabled,
    staleTime: 0,
    gcTime: 60_000,
    refetchInterval: (query) => {
      const s = (query.state.data as HealthResponse | undefined)?.status ?? 'ok';
      return s === 'ok' || s === 'unknown' ? 30_000 : 10_000;
    },
    refetchOnWindowFocus: true,
    retry: false,
  });

  const state: HealthState = enabled ? (data?.status ?? 'unknown') : 'ok';
  const prevStateRef = useRef<HealthState>('unknown');

  useEffect(() => {
    const prev = prevStateRef.current;
    if (state !== prev && state !== 'unknown' && prev !== 'unknown') {
      enqueue({
        type: 'client.maintenance_state_changed',
        from: prev,
        to: state,
        incidentId: data?.incidentId ?? null,
      });
    }
    prevStateRef.current = state;
  }, [state, data?.incidentId]);

  return { state, incidentId: data?.incidentId };
}
