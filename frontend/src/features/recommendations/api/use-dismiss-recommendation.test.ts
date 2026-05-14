import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useDismissRecommendation } from './use-dismiss-recommendation';
import { recommendationKeys } from '../../../api/query-keys';
import type { Recommendation } from '../types';

const toastSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue(undefined),
  ApiException: class ApiException extends Error {},
}));

vi.mock('../../../lib/events/client-event', () => ({
  emitRecommendationDismissed: vi.fn(),
  emitRecommendationSuspicious: vi.fn(),
  emitRecommendationShown: vi.fn(),
}));

vi.mock('../../../hooks/use-toast', () => ({ toast: toastSpy }));

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    habitId: 'habit-1',
    category: 'reschedule',
    source: 'rule',
    title: 'Move reminder',
    body: 'Your best hour is 18:00.',
    priority: 70,
    status: 'active',
    actionPayload: null,
    experimentVariant: null,
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDismissRecommendation', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData<Recommendation[]>(recommendationKeys.active(), [makeRec()]);
    toastSpy.mockClear();
  });

  it('optimistically removes the rec from the feed', async () => {
    const { result } = renderHook(() => useDismissRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() => {
      const cached = qc.getQueryData<Recommendation[]>(recommendationKeys.active());
      expect(cached?.find((r) => r.id === 'rec-1')).toBeUndefined();
    });
  });

  it('shows cooldown toast with the habit name on success', async () => {
    const { result } = renderHook(() => useDismissRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Run'), 'info'),
    );
  });

  it('toast message mentions 14 days', async () => {
    const { result } = renderHook(() => useDismissRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() => {
      const [msg] = toastSpy.mock.calls[0] as [string, string];
      expect(msg).toContain('14 days');
    });
  });

  it('toast message does NOT contain Undo (v1 terminal dismiss)', async () => {
    const { result } = renderHook(() => useDismissRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());

    const [msg] = toastSpy.mock.calls[0] as [string, string];
    expect(msg).not.toContain('Undo');
  });

  it('rolls back optimistic update on error', async () => {
    const { apiFetch } = await import('../../../api/client');
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useDismissRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() => result.current.isError);

    const cached = qc.getQueryData<Recommendation[]>(recommendationKeys.active());
    expect(cached?.find((r) => r.id === 'rec-1')).toBeDefined();
  });
});
