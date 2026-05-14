import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useAcceptRecommendation } from './use-accept-recommendation';
import { recommendationKeys } from '../../../api/query-keys';
import * as broadcast from '../../../lib/broadcast';
import * as invalidation from '../../../api/_invalidation';
import type { Recommendation } from '../types';

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue(undefined),
  ApiException: class ApiException extends Error {},
}));

vi.mock('../../../lib/events/client-event', () => ({
  emitRecommendationAccepted: vi.fn(),
  emitRecommendationSuspicious: vi.fn(),
  emitRecommendationShown: vi.fn(),
}));

vi.mock('../../../hooks/use-toast', () => ({ toast: vi.fn() }));

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
    actionPayload: { category: 'reschedule', preferredTime: '18:00' },
    experimentVariant: null,
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeWrapper(qc: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

describe('useAcceptRecommendation', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    // Seed recs cache
    qc.setQueryData<Recommendation[]>(recommendationKeys.active(), [makeRec()]);
  });

  it('optimistically removes the rec from the active feed', async () => {
    const { result } = renderHook(() => useAcceptRecommendation(), {
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

  it('calls invalidateOnRecommendationAccept with reschedule + habitId on success', async () => {
    const spy = vi.spyOn(invalidation, 'invalidateOnRecommendationAccept').mockResolvedValue();

    const { result } = renderHook(() => useAcceptRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() => expect(spy).toHaveBeenCalledWith(qc, 'reschedule', 'habit-1'));
  });

  it('invalidationKeysForAccept: non-side-effect categories do NOT include habitKeys', () => {
    const nonHabitCategories = [
      'streak_celebration',
      'encouragement_after_skip',
      'consistency_reinforcement',
      'retroactive_logging_reminder',
      'reduce_difficulty',
    ] as const;

    for (const cat of nonHabitCategories) {
      const keys = invalidation.invalidationKeysForAccept(cat, 'habit-1');
      const hasHabitDetail = keys.some(
        (k) => Array.isArray(k) && k.includes('detail'),
      );
      expect(hasHabitDetail).toBe(false);
    }
  });

  it('invalidationKeysForAccept: reschedule includes habitKeys.detail and habitKeys.lists', () => {
    const keys = invalidation.invalidationKeysForAccept('reschedule', 'habit-1');
    const hasDetail = keys.some((k) => Array.isArray(k) && k.includes('detail'));
    const hasList = keys.some((k) => Array.isArray(k) && k.includes('list'));
    expect(hasDetail).toBe(true);
    expect(hasList).toBe(true);
  });

  it('broadcasts HABIT_MUTATED on reschedule accept success', async () => {
    const postSpy = vi.spyOn(broadcast, 'postHabitMutated').mockImplementation(() => undefined);

    const { result } = renderHook(() => useAcceptRecommendation(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ recommendation: makeRec(), habitName: 'Run' });
    });

    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith({
        habitId: 'habit-1',
        source: 'recommendation_accept',
        fields: ['preferred_time'],
      }),
    );
  });

  it('rolls back optimistic update on error', async () => {
    const { apiFetch } = await import('../../../api/client');
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useAcceptRecommendation(), {
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
