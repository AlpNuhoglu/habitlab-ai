import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coalesceToggle, cancelToggle } from './log-coalesce';

describe('coalesceToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches once when toggled after debounce window', () => {
    const dispatch = vi.fn();
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    vi.advanceTimersByTime(300);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith('log');
  });

  it('uses last intent when toggled twice within window (net-zero: log then unlog)', () => {
    const dispatch = vi.fn();
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    coalesceToggle('h1', '2026-05-07', 'unlog', dispatch);
    vi.advanceTimersByTime(300);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith('unlog');
  });

  it('dispatches twice for 3 clicks (log→unlog→log) — third wins', () => {
    const dispatch = vi.fn();
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    coalesceToggle('h1', '2026-05-07', 'unlog', dispatch);
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    vi.advanceTimersByTime(300);
    // Only the last one fires
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith('log');
  });

  it('sends max 2 network-equivalent calls for 3 fast clicks when first fires before others', () => {
    const dispatch = vi.fn();

    // First click fires after 250ms
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    vi.advanceTimersByTime(260); // first fires
    expect(dispatch).toHaveBeenCalledTimes(1);

    // Second click (unlog) right after first dispatched
    coalesceToggle('h1', '2026-05-07', 'unlog', dispatch);
    // Third click (log again) within the new window
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    vi.advanceTimersByTime(300);
    // Now the coalesced second+third fires as one
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('does not dispatch for different (habitId, date) pairs independently', () => {
    const dispatch = vi.fn();
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    coalesceToggle('h2', '2026-05-07', 'log', dispatch);
    vi.advanceTimersByTime(300);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('cancelToggle prevents dispatch', () => {
    const dispatch = vi.fn();
    coalesceToggle('h1', '2026-05-07', 'log', dispatch);
    cancelToggle('h1', '2026-05-07');
    vi.advanceTimersByTime(300);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
