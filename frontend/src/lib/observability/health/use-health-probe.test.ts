import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useHealthProbe } from './use-health-probe';

const enqueuedEvents: unknown[] = [];
vi.mock('../../events/event-sink', () => ({
  enqueue: (event: unknown) => enqueuedEvents.push(event),
}));

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  enqueuedEvents.splice(0);
  vi.clearAllMocks();
  vi.stubEnv('VITE_HEALTH_PROBE_ENABLED', 'false');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('useHealthProbe', () => {
  it('returns state=ok immediately when probe disabled', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useHealthProbe(), { wrapper: makeWrapper(qc) });
    expect(result.current.state).toBe('ok');
  });

  it('does not fetch when disabled', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useHealthProbe(), { wrapper: makeWrapper(qc) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches /healthz/public when enabled', async () => {
    vi.stubEnv('VITE_HEALTH_PROBE_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    }));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useHealthProbe(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.state).toBe('ok'));
    expect(fetch).toHaveBeenCalledWith('/healthz/public', { credentials: 'omit' });
  });

  it('emits client.maintenance_state_changed on ok→maintenance transition', async () => {
    vi.stubEnv('VITE_HEALTH_PROBE_ENABLED', 'true');

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      const status = callCount === 1 ? 'ok' : 'maintenance';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status, incidentId: callCount === 2 ? 'inc-1' : undefined }),
      });
    }));

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchInterval: false } },
    });
    const { result, rerender } = renderHook(() => useHealthProbe(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.state).toBe('ok'));

    // Invalidate to trigger a second fetch returning 'maintenance'
    await qc.invalidateQueries({ queryKey: ['observability', 'health'] });
    rerender();

    await waitFor(() => expect(result.current.state).toBe('maintenance'));

    const evt = enqueuedEvents.find(
      (e) => (e as { type: string }).type === 'client.maintenance_state_changed',
    ) as { from: string; to: string; incidentId: string | null } | undefined;

    expect(evt).toBeDefined();
    expect(evt!.from).toBe('ok');
    expect(evt!.to).toBe('maintenance');
    expect(evt!.incidentId).toBe('inc-1');
  });

  it('returns unknown state on network error when enabled', async () => {
    vi.stubEnv('VITE_HEALTH_PROBE_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useHealthProbe(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.state).toBe('unknown'));
  });
});
