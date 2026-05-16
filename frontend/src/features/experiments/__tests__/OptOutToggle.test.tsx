import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { authKeys } from '../../../api/query-keys';
import { OptOutToggle } from '../components/OptOutToggle';
import type { AuthUser } from '../../auth/types';

function makeUser(optedOut: boolean): AuthUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: null,
    timezone: 'UTC',
    locale: 'en',
    emailVerifiedAt: '2024-01-01T00:00:00Z',
    preferences: {
      ai_recommendations_enabled: true,
      experiments_opted_out: optedOut,
      hints_include_notes: false,
      quiet_hours: { start: '22:00', end: '07:00' },
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('<OptOutToggle>', () => {
  it('shows checkbox unchecked when not opted out', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(authKeys.me(), makeUser(false));

    render(<OptOutToggle />, { wrapper: makeWrapper(qc) });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('shows checkbox checked when opted out', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(authKeys.me(), makeUser(true));

    render(<OptOutToggle />, { wrapper: makeWrapper(qc) });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('optimistically flips and rolls back on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(authKeys.me(), makeUser(false));

    render(<OptOutToggle />, { wrapper: makeWrapper(qc) });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

    fireEvent.click(checkbox);

    // Optimistic flip
    await waitFor(() => expect(checkbox.checked).toBe(true));

    // On error, roll back
    await waitFor(() => expect(checkbox.checked).toBe(false), { timeout: 3000 });

    vi.unstubAllGlobals();
  });
});
