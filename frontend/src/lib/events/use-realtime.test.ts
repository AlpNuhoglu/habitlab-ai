import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtime } from './use-realtime';

describe('useRealtime stub', () => {
  it('returns isConnected: false', () => {
    const { result } = renderHook(() =>
      useRealtime({ channel: 'habits', onEvent: () => undefined }),
    );
    expect(result.current.isConnected).toBe(false);
  });

  it('disconnect is a callable no-op', () => {
    const { result } = renderHook(() =>
      useRealtime({ channel: 'habits', onEvent: () => undefined }),
    );
    expect(() => act(() => result.current.disconnect())).not.toThrow();
  });

  it('onEvent is never called (stub makes no network connections)', () => {
    const handler = vi.fn();
    renderHook(() => useRealtime({ channel: 'habits', onEvent: handler }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('enabled: false does not affect the no-op behaviour', () => {
    const { result } = renderHook(() =>
      useRealtime({ channel: 'habits', onEvent: () => undefined, enabled: false }),
    );
    expect(result.current.isConnected).toBe(false);
  });

  it('accepts generic event type without runtime error', () => {
    interface HabitEvent { habitId: string }
    const { result } = renderHook(() =>
      useRealtime<HabitEvent>({
        channel: 'habits',
        onEvent: (_e: HabitEvent) => undefined,
      }),
    );
    expect(result.current.isConnected).toBe(false);
  });
});
