import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUser = {
  id: 'u1', email: 'a@b.com', displayName: null, timezone: 'UTC', locale: 'en' as const,
  emailVerifiedAt: null,
  preferences: {
    ai_recommendations_enabled: true,
    experiments_opted_out: false,
    hints_include_notes: false,
    quiet_hours: { start: '22:00', end: '07:00' },
  },
  createdAt: '', updatedAt: '',
};

vi.mock('../../auth/api/use-current-user', () => ({
  useCurrentUser: () => ({ user: mockUser }),
}));

const mutateFn = vi.fn();
vi.mock('../api/use-update-quiet-hours', () => ({
  useUpdateQuietHours: () => ({ mutate: mutateFn, isError: false, isPending: false }),
}));

vi.mock('../lib/push-channel', () => ({
  postQuietHoursChanged: vi.fn(),
}));

import { QuietHoursEditor } from './QuietHoursEditor';

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function getTimeInputs() {
  return document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
}

describe('QuietHoursEditor', () => {
  afterEach(() => {
    mutateFn.mockReset();
    vi.useRealTimers();
  });

  it('renders start and end time inputs with initial user preference values', () => {
    render(<QuietHoursEditor />, { wrapper: Wrapper });
    const [start, end] = getTimeInputs();
    expect(start?.value).toBe('22:00');
    expect(end?.value).toBe('07:00');
  });

  it('debounces PATCH: only calls mutate once after 300ms', () => {
    vi.useFakeTimers();
    render(<QuietHoursEditor />, { wrapper: Wrapper });
    const [startInput] = getTimeInputs();

    fireEvent.change(startInput!, { target: { value: '21:00' } });
    fireEvent.change(startInput!, { target: { value: '20:00' } });

    expect(mutateFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(mutateFn).toHaveBeenCalledTimes(1);
    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({ start: '20:00' }),
      expect.any(Object),
    );
  });

  it('shows overnight wrap helper text when start > end', () => {
    render(<QuietHoursEditor />, { wrapper: Wrapper });
    expect(screen.getByText(/overnight/)).toBeTruthy();
  });
});
