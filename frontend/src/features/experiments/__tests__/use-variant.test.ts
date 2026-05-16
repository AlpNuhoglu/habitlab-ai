import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { experimentKeys } from '../../../api/query-keys';
import { useVariant } from '../hooks/use-variant';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';
import { makeAssignmentsMap } from '../testing/fixtures';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useVariant', () => {
  it('returns control when cache is empty', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useVariant('rec_copy_v1'), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current).toBe('control');
  });

  it('returns the assigned variant from cache', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(
      experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS),
      makeAssignmentsMap({ rec_copy_v1: 'treatment' }),
    );
    const { result } = renderHook(() => useVariant('rec_copy_v1'), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current).toBe('treatment');
  });

  it('does not trigger a network call', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let fetchCalled = false;
    qc.setQueryDefaults(experimentKeys.all, {
      queryFn: () => {
        fetchCalled = true;
        return {};
      },
    });
    renderHook(() => useVariant('rec_copy_v1'), { wrapper: makeWrapper(qc) });
    expect(fetchCalled).toBe(false);
  });
});
