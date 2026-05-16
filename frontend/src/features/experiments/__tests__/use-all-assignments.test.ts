import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useAllAssignments } from '../api/use-all-assignments';

// Mock apiFetch so we don't need a running server
vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
  ApiException: class ApiException extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import * as clientModule from '../../../api/client';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useAllAssignments', () => {
  it('returns assignments map on success', async () => {
    const mockData = { rec_copy_v1: 'treatment', notification_copy_v1: 'control' };
    vi.mocked(clientModule.apiFetch).mockResolvedValueOnce(mockData);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAllAssignments(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toEqual(mockData);
  });

  it('enters error state on fetch failure without throwing', async () => {
    // Reject both the initial call and any retry so the query reaches error state quickly.
    vi.mocked(clientModule.apiFetch).mockRejectedValue(new Error('Service Unavailable'));

    // Override retry to 0 so the query fails immediately without backoff.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useAllAssignments(),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
